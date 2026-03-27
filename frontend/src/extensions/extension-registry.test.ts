import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { lazy } from 'react';
import {
  FrontendExtensionRegistry,
  frontendExtensionRegistry,
  type ScrumForgeFrontendExtension,
  type FrontendNavItem,
  type FrontendRouteConfig,
} from './extension-registry';

// Helper: crea una extensión mínima válida
function makeExtension(overrides: Partial<ScrumForgeFrontendExtension> = {}): ScrumForgeFrontendExtension {
  return { name: 'test-ext', version: '1.0.0', ...overrides };
}

// ── Tests sobre el singleton global ────────────────────────────────────────

describe('frontendExtensionRegistry (singleton)', () => {
  afterEach(() => {
    frontendExtensionRegistry._reset();
  });

  it('registra una extensión y la devuelve en getAll()', () => {
    const ext = makeExtension({ name: 'ext-a' });
    frontendExtensionRegistry.register(ext);
    expect(frontendExtensionRegistry.getAll()).toContain(ext);
  });

  it('has() devuelve true para registrada y false para la que no lo está', () => {
    frontendExtensionRegistry.register(makeExtension({ name: 'registered' }));
    expect(frontendExtensionRegistry.has('registered')).toBe(true);
    expect(frontendExtensionRegistry.has('not-registered')).toBe(false);
  });

  it('lanza error si se registra el mismo nombre dos veces', () => {
    frontendExtensionRegistry.register(makeExtension({ name: 'dup' }));
    expect(() => frontendExtensionRegistry.register(makeExtension({ name: 'dup' }))).toThrow(/ya está registrada/);
  });

  it('_reset() limpia el registro', () => {
    frontendExtensionRegistry.register(makeExtension({ name: 'to-reset' }));
    frontendExtensionRegistry._reset();
    expect(frontendExtensionRegistry.getAll()).toHaveLength(0);
  });
});

// ── Tests sobre instancias aisladas ────────────────────────────────────────

describe('FrontendExtensionRegistry', () => {
  let registry: FrontendExtensionRegistry;

  beforeEach(() => {
    registry = new FrontendExtensionRegistry();
  });

  // ── Registro básico ──────────────────────────────────────────────────────

  it('registra una extensión sin lanzar error', () => {
    expect(() => registry.register(makeExtension())).not.toThrow();
  });

  it('getAll() devuelve array vacío si no hay extensiones', () => {
    expect(registry.getAll()).toHaveLength(0);
  });

  it('mantiene el orden de registro en getAll()', () => {
    registry.register(makeExtension({ name: 'first' }));
    registry.register(makeExtension({ name: 'second' }));
    registry.register(makeExtension({ name: 'third' }));
    expect(registry.getAll().map((e) => e.name)).toEqual(['first', 'second', 'third']);
  });

  // ── Nav items ────────────────────────────────────────────────────────────

  it('getNavItems() devuelve [] si ninguna extensión tiene navItems', () => {
    registry.register(makeExtension());
    expect(registry.getNavItems()).toHaveLength(0);
  });

  it('getNavItems() agrega nav items de todas las extensiones', () => {
    const item1: FrontendNavItem = { icon: '📖', key: 'wiki', navKey: 'nav.wiki', route: '/wiki' };
    const item2: FrontendNavItem = { icon: '⚡', key: 'auto', navKey: 'nav.auto', route: '/auto' };
    registry.register(makeExtension({ name: 'ext-a', navItems: [item1] }));
    registry.register(makeExtension({ name: 'ext-b', navItems: [item2] }));
    expect(registry.getNavItems()).toEqual([item1, item2]);
  });

  // ── Rutas ────────────────────────────────────────────────────────────────

  it('getRoutes() devuelve [] si ninguna extensión tiene routes', () => {
    registry.register(makeExtension());
    expect(registry.getRoutes()).toHaveLength(0);
  });

  it('getRoutes() agrega rutas de todas las extensiones', () => {
    const comp = lazy(() => Promise.resolve({ default: () => null }));
    const route: FrontendRouteConfig = { path: 'projects/:id/wiki', component: comp };
    registry.register(makeExtension({ name: 'wiki', routes: [route] }));
    expect(registry.getRoutes()).toContain(route);
  });

  // ── Slots ────────────────────────────────────────────────────────────────

  it('getSlot() devuelve undefined si el slot no está registrado', () => {
    expect(registry.getSlot('nonexistent-slot')).toBeUndefined();
  });

  it('getSlot() devuelve el componente del slot registrado', () => {
    const comp = lazy(() => Promise.resolve({ default: () => null })) as ReturnType<typeof lazy>;
    registry.register(
      makeExtension({
        name: 'with-slot',
        slots: { 'my-slot': comp as never },
      }),
    );
    expect(registry.getSlot('my-slot')).toBe(comp);
  });

  it('getSlot() devuelve el slot de la primera extensión que lo registre', () => {
    const compA = lazy(() => Promise.resolve({ default: () => null })) as ReturnType<typeof lazy>;
    const compB = lazy(() => Promise.resolve({ default: () => null })) as ReturnType<typeof lazy>;
    registry.register(makeExtension({ name: 'ext-a', slots: { 'shared-slot': compA as never } }));
    registry.register(makeExtension({ name: 'ext-b', slots: { 'shared-slot': compB as never } }));
    // Primera extensión registrada tiene precedencia
    expect(registry.getSlot('shared-slot')).toBe(compA);
  });

  // ── _reset ───────────────────────────────────────────────────────────────

  it('_reset() limpia todas las extensiones', () => {
    registry.register(makeExtension({ name: 'ext-1' }));
    registry.register(makeExtension({ name: 'ext-2' }));
    registry._reset();
    expect(registry.getAll()).toHaveLength(0);
    expect(registry.has('ext-1')).toBe(false);
  });

  it('permite registrar de nuevo tras _reset()', () => {
    registry.register(makeExtension({ name: 'reused' }));
    registry._reset();
    expect(() => registry.register(makeExtension({ name: 'reused' }))).not.toThrow();
  });
});
