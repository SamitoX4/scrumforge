import { extensionRegistry } from './extension-registry';
import { logger } from '../utils/logger';

/**
 * Lee la variable de entorno ENABLED_EXTENSIONS (CSV) y registra
 * dinámicamente los paquetes de extensión correspondientes.
 *
 * Formato: ENABLED_EXTENSIONS=planning-poker,ai,integrations
 *
 * Cada extensión debe estar instalada como paquete npm bajo el scope
 * @scrumforge (ej. @scrumforge/ext-planning-poker).
 *
 * En Paso 0 esta función no carga nada porque los paquetes premium
 * aún no existen como paquetes separados. Los módulos equivalentes
 * (poker, ai, integrations) siguen registrándose directamente en schema.ts.
 * Esta función se irá llenando a medida que se completen los pasos 1-7.
 */
export async function loadExtensions(): Promise<void> {
  const raw = process.env.ENABLED_EXTENSIONS ?? '';
  const names = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (names.length === 0) {
    logger.info('[Extensions] No hay extensiones externas habilitadas (ENABLED_EXTENSIONS vacío).');
    return;
  }

  logger.info({ extensions: names }, '[Extensions] Cargando extensiones externas...');

  for (const name of names) {
    await loadExtension(name);
  }
}

/**
 * Mapa de nombre corto → localización de la extensión.
 *
 * Durante el desarrollo en el monorepo, las extensiones viven como módulos
 * locales (prefijo 'local:'). Al publicar el paquete npm privado, se cambia
 * la entrada al nombre del paquete (ej. '@scrumforge/backend-ext-planning-poker').
 *
 * Convención de prefijos:
 *   'local:./foo'           → import('./foo') relativo a este archivo
 *   '@scope/package-name'   → import desde node_modules (producción)
 */
const EXTENSION_MAP: Record<string, string> = {
  'planning-poker':        'local:./planning-poker',
  'ai':                    'local:./ai',
  'integrations':          'local:./integrations',
  'advanced-reports':      'local:./advanced-reports',
  'retrospective-premium': 'local:./retrospective-premium',
  'wiki':                  'local:./wiki',
  'billing-stripe':        'local:./billing-stripe',
};

async function loadExtension(name: string): Promise<void> {
  const location = EXTENSION_MAP[name];
  if (!location) {
    logger.warn(
      `[Extensions] Extensión desconocida: '${name}'. ` +
      `Nombres válidos: ${Object.keys(EXTENSION_MAP).join(', ')}`,
    );
    return;
  }

  const isLocal = location.startsWith('local:');
  const importPath = isLocal ? location.slice('local:'.length) : location;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = await import(importPath);
    const extension = mod.default ?? mod[toCamelCase(name) + 'Extension'];

    if (!extension) {
      logger.error(
        `[Extensions] '${importPath}' no exporta una extensión válida. ` +
        `Verifica que exporte 'default' o '${toCamelCase(name)}Extension'.`,
      );
      return;
    }

    extensionRegistry.register(extension);
  } catch (err: unknown) {
    if (!isLocal && isModuleNotFound(err, importPath)) {
      logger.warn(
        `[Extensions] El paquete '${importPath}' no está instalado. ` +
        `Instálalo con: npm install ${importPath}`,
      );
    } else {
      logger.error({ err }, `[Extensions] Error al cargar '${importPath}'.`);
    }
  }
}

function toCamelCase(kebab: string): string {
  return kebab.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function isModuleNotFound(err: unknown, packageName: string): boolean {
  return (
    err instanceof Error &&
    'code' in err &&
    (err as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND' &&
    err.message.includes(packageName)
  );
}
