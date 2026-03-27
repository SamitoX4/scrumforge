import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
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
  // Extensiones premium — el cliente coloca los paquetes compilados en backend/extensions/
  // Ejemplo: copiar la carpeta backend-ext-planning-poker → backend/extensions/backend-ext-planning-poker/
  'planning-poker':        'local:../../extensions/backend-ext-planning-poker',
  'ai':                    'local:../../extensions/backend-ext-ai',
  'integrations':          'local:../../extensions/backend-ext-integrations',
  'advanced-reports':      'local:../../extensions/backend-ext-advanced-reports',
  'retrospective-premium': 'local:../../extensions/backend-ext-retrospective-premium',
  'wiki':                  'local:../../extensions/backend-ext-wiki',
  'billing-stripe':        'local:../../extensions/backend-ext-billing-stripe',
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
  const rawPath = isLocal ? location.slice('local:'.length) : location;

  let importPath: string;

  if (isLocal) {
    const absDir = resolve(__dirname, rawPath);

    // Carpeta no instalada — omitir silenciosamente
    if (!existsSync(absDir)) {
      logger.debug(`[Extensions] '${name}' no está instalada (carpeta no encontrada), omitiendo.`);
      return;
    }

    // En ESM, importar un directorio relativo NO lee el campo "main" de package.json.
    // Leemos package.json manualmente para obtener el entry point real.
    try {
      const pkg = JSON.parse(readFileSync(resolve(absDir, 'package.json'), 'utf8')) as { main?: string };
      importPath = resolve(absDir, pkg.main ?? 'dist/index.js');
    } catch {
      importPath = resolve(absDir, 'dist/index.js');
    }
  } else {
    importPath = rawPath;
  }

  try {
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
    if (isModuleNotFound(err, importPath)) {
      if (isLocal) {
        logger.debug(`[Extensions] '${name}' no está instalada (archivo no encontrado), omitiendo.`);
      } else {
        logger.warn(
          `[Extensions] El paquete '${importPath}' no está instalado. ` +
          `Instálalo con: npm install ${importPath}`,
        );
      }
    } else {
      logger.error({ err }, `[Extensions] Error al cargar '${importPath}'.`);
    }
  }
}

function toCamelCase(kebab: string): string {
  return kebab.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function isModuleNotFound(err: unknown, importPath: string): boolean {
  if (!(err instanceof Error) || !('code' in err)) return false;
  if ((err as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') return false;
  return err.message.includes(importPath);
}
