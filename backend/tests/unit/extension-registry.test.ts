import { parse } from 'graphql';
import {
  ExtensionRegistry,
  extensionRegistry,
  CORE_EXTENSION_API_VERSION,
} from '../../src/extensions/extension-registry';
import type { ScrumForgeExtension, ExtensionInitContext } from '../../src/extensions/extension-registry';

// Helper: crea una extensión mínima válida
function makeExtension(overrides: Partial<ScrumForgeExtension> = {}): ScrumForgeExtension {
  return {
    name: 'test-extension',
    version: '1.0.0',
    ...overrides,
  };
}

// Silencia los logs de info durante los tests
jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('ExtensionRegistry', () => {
  afterEach(() => {
    // Limpiar el singleton entre tests que lo usen
    extensionRegistry._reset();
  });

  // ── Registro ───────────────────────────────────────────────────────────────

  it('registra una extensión válida sin errores', () => {
    expect(() => {
      extensionRegistry.register(makeExtension());
    }).not.toThrow();
  });

  it('confirma que la extensión registrada aparece en getAll()', () => {
    const ext = makeExtension({ name: 'ext-a' });
    extensionRegistry.register(ext);
    expect(extensionRegistry.getAll()).toContain(ext);
  });

  it('has() devuelve true para extensión registrada y false para la que no lo está', () => {
    extensionRegistry.register(makeExtension({ name: 'registered' }));
    expect(extensionRegistry.has('registered')).toBe(true);
    expect(extensionRegistry.has('not-registered')).toBe(false);
  });

  it('lanza error si se registra la misma extensión dos veces', () => {
    extensionRegistry.register(makeExtension({ name: 'duplicate' }));
    expect(() => {
      extensionRegistry.register(makeExtension({ name: 'duplicate' }));
    }).toThrow(/ya está registrada/);
  });

  it('lanza error si la extensión requiere una versión mayor del core API', () => {
    expect(() => {
      extensionRegistry.register(
        makeExtension({ requiredCoreApiVersion: CORE_EXTENSION_API_VERSION + 999 }),
      );
    }).toThrow(/requiere core API/);
  });

  it('acepta extensión que requiere exactamente la versión actual del core', () => {
    expect(() => {
      extensionRegistry.register(
        makeExtension({ requiredCoreApiVersion: CORE_EXTENSION_API_VERSION }),
      );
    }).not.toThrow();
  });

  // ── TypeDefs y Resolvers ───────────────────────────────────────────────────

  it('getTypeDefs() devuelve array vacío cuando ninguna extensión tiene typeDefs', () => {
    extensionRegistry.register(makeExtension({ typeDefs: undefined }));
    expect(extensionRegistry.getTypeDefs()).toHaveLength(0);
  });

  it('getTypeDefs() devuelve los DocumentNodes de las extensiones', () => {
    const doc = parse('extend type Query { pingPremium: String }');
    extensionRegistry.register(makeExtension({ typeDefs: doc }));
    const typeDefs = extensionRegistry.getTypeDefs();
    expect(typeDefs).toHaveLength(1);
    expect(typeDefs[0]).toBe(doc);
  });

  it('getTypeDefs() aplana arrays de DocumentNodes', () => {
    const doc1 = parse('extend type Query { ping1: String }');
    const doc2 = parse('extend type Query { ping2: String }');
    extensionRegistry.register(makeExtension({ typeDefs: [doc1, doc2] }));
    expect(extensionRegistry.getTypeDefs()).toHaveLength(2);
  });

  it('getResolvers() devuelve array vacío cuando ninguna extensión tiene resolvers', () => {
    extensionRegistry.register(makeExtension({ resolvers: undefined }));
    expect(extensionRegistry.getResolvers()).toHaveLength(0);
  });

  it('getResolvers() devuelve los resolvers de las extensiones', () => {
    const resolvers = { Query: { pingPremium: () => 'pong' } };
    extensionRegistry.register(makeExtension({ resolvers }));
    expect(extensionRegistry.getResolvers()).toContain(resolvers);
  });

  // ── initAll ────────────────────────────────────────────────────────────────

  it('initAll() llama onInit de cada extensión con el contexto inyectado', async () => {
    const onInit = jest.fn().mockResolvedValue(undefined);
    extensionRegistry.register(makeExtension({ onInit }));

    const ctx = {
      prisma: {} as ExtensionInitContext['prisma'],
      pubsub: {} as ExtensionInitContext['pubsub'],
      eventBus: {} as ExtensionInitContext['eventBus'],
    };

    await extensionRegistry.initAll(ctx);

    expect(onInit).toHaveBeenCalledTimes(1);
    expect(onInit).toHaveBeenCalledWith(ctx);
  });

  it('initAll() no falla cuando una extensión no tiene onInit', async () => {
    extensionRegistry.register(makeExtension({ onInit: undefined }));
    const ctx = {
      prisma: {} as ExtensionInitContext['prisma'],
      pubsub: {} as ExtensionInitContext['pubsub'],
      eventBus: {} as ExtensionInitContext['eventBus'],
    };
    await expect(extensionRegistry.initAll(ctx)).resolves.not.toThrow();
  });

  it('lanza error si se registra una extensión después de initAll()', async () => {
    const ctx = {
      prisma: {} as ExtensionInitContext['prisma'],
      pubsub: {} as ExtensionInitContext['pubsub'],
      eventBus: {} as ExtensionInitContext['eventBus'],
    };
    await extensionRegistry.initAll(ctx);

    expect(() => {
      extensionRegistry.register(makeExtension({ name: 'late-ext' }));
    }).toThrow(/después de initAll/);
  });

  it('lanza error si initAll() se llama dos veces', async () => {
    const ctx = {
      prisma: {} as ExtensionInitContext['prisma'],
      pubsub: {} as ExtensionInitContext['pubsub'],
      eventBus: {} as ExtensionInitContext['eventBus'],
    };
    await extensionRegistry.initAll(ctx);
    await expect(extensionRegistry.initAll(ctx)).rejects.toThrow(/ya fue llamado/);
  });

  it('propaga errores de onInit sin silenciarlos', async () => {
    extensionRegistry.register(
      makeExtension({
        onInit: async () => { throw new Error('fallo en init'); },
      }),
    );
    const ctx = {
      prisma: {} as ExtensionInitContext['prisma'],
      pubsub: {} as ExtensionInitContext['pubsub'],
      eventBus: {} as ExtensionInitContext['eventBus'],
    };
    await expect(extensionRegistry.initAll(ctx)).rejects.toThrow('fallo en init');
  });

  // ── Múltiples extensiones ──────────────────────────────────────────────────

  it('mantiene el orden de registro en getAll()', () => {
    extensionRegistry.register(makeExtension({ name: 'first' }));
    extensionRegistry.register(makeExtension({ name: 'second' }));
    extensionRegistry.register(makeExtension({ name: 'third' }));

    const names = extensionRegistry.getAll().map((e) => e.name);
    expect(names).toEqual(['first', 'second', 'third']);
  });
});
