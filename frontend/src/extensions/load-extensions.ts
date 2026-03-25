/**
 * @file load-extensions.ts
 * @description Punto de entrada del sistema de extensiones del frontend.
 *
 * Este módulo implementa la carga diferida (lazy) y el registro de extensiones
 * de UI de ScrumForge. Las extensiones son módulos opcionales (planning-poker,
 * wiki, IA, etc.) que se añaden al core sin modificarlo, mediante un patrón de
 * slots e inyección de rutas/nav items.
 *
 * Flujo de bootstrap:
 *   1. main.tsx llama a `loadFrontendExtensions()` antes de `ReactDOM.render`.
 *   2. Esta función lee la variable de entorno `VITE_ENABLED_EXTENSIONS`.
 *   3. Por cada extensión habilitada, llama a `loadExtension(name)`.
 *   4. `loadExtension` importa dinámicamente el módulo y registra el objeto
 *      `ScrumForgeFrontendExtension` en el singleton `frontendExtensionRegistry`.
 *   5. React monta la app con el registro ya completo → sin race conditions.
 */
import { frontendExtensionRegistry } from './extension-registry';
import type { ScrumForgeFrontendExtension } from './extension-registry';

/**
 * Mapa estático de loaders por nombre de extensión.
 *
 * Vite necesita que los imports dinámicos sean literales de string para
 * poder analizar el grafo de módulos en dev y en build. Usar un mapa de
 * funciones arrow con import() literales es el patrón correcto.
 *
 * Cada valor es una función que devuelve una Promise del módulo, no el módulo
 * en sí — esto garantiza que el chunk solo se descarga cuando realmente se
 * necesita (tree-shaking y code splitting automáticos de Vite).
 *
 * Para añadir una extensión nueva:
 *   1. Crea su carpeta en src/extensions/<nombre>/
 *   2. Añade una entrada aquí con su import() literal.
 *   3. Asegúrate de que el módulo exporte `default` o `<camelCase>UiExtension`.
 */
const EXTENSION_LOADERS: Record<string, () => Promise<Record<string, unknown>>> = {
  // Los aliases @scrumforge/frontend-ext-* se resuelven en vite.config.ts:
  //   1. frontend/extensions/<name>/  (paquete descargado del portal)
  //   2. ../../scrumforge-extensions/packages/frontend-ext-<name>/  (dev monorepo)
  //   3. src/extensions/_stub.ts      (stub vacío — extensión no instalada)
  'planning-poker':        () => import('@scrumforge/frontend-ext-planning-poker'),
  'wiki':                  () => import('@scrumforge/frontend-ext-wiki'),
  'retrospective-premium': () => import('@scrumforge/frontend-ext-retrospective-premium'),
  'advanced-reports':      () => import('@scrumforge/frontend-ext-advanced-reports'),
  'ai':                    () => import('@scrumforge/frontend-ext-ai'),
  'integrations':          () => import('@scrumforge/frontend-ext-integrations'),
  'billing-stripe':        () => import('@scrumforge/frontend-ext-billing-stripe'),
};

/**
 * Carga y registra las extensiones de UI habilitadas para esta instancia.
 *
 * Lee `VITE_ENABLED_EXTENSIONS` (variable de entorno inyectada por Vite en
 * tiempo de build) para determinar qué extensiones activar:
 *
 * | Valor de `VITE_ENABLED_EXTENSIONS` | Resultado                                      |
 * |------------------------------------|------------------------------------------------|
 * | `undefined` (no definida)          | Carga **todas** las extensiones disponibles    |
 * | `""` (cadena vacía)                | No carga ninguna extensión (core puro)         |
 * | `"wiki,ai"`                        | Carga solo las extensiones indicadas           |
 *
 * El uso de `Promise.all` garantiza que todas las extensiones se cargan en
 * paralelo, minimizando el tiempo de bootstrap.
 *
 * @returns Promesa que resuelve cuando todas las extensiones habilitadas han
 *          sido cargadas e incorporadas al registro. Los fallos individuales
 *          se tragan con un `warn` para no bloquear el arranque del core.
 *
 * @example
 * // En main.tsx, antes de montar React:
 * await loadFrontendExtensions();
 * ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
 */
export async function loadFrontendExtensions(): Promise<void> {
  const raw = (import.meta.env.VITE_ENABLED_EXTENSIONS as string | undefined);

  // Si la variable no está definida en absoluto (undefined), activamos todo
  // (modo monorepo/desarrollo). Si está definida pero vacía, no hay extensiones.
  const names =
    raw === undefined
      ? Object.keys(EXTENSION_LOADERS)   // dev: intentar cargar todas
      : raw.split(',').map((s) => s.trim()).filter(Boolean);

  if (names.length === 0) {
    console.info('[FrontendExtensions] Sin extensiones habilitadas (VITE_ENABLED_EXTENSIONS="").');
    return;
  }

  console.info('[FrontendExtensions] Cargando extensiones:', names);

  // Carga en paralelo para no serializar los roundtrips de red/disco
  await Promise.all(names.map((name) => loadExtension(name)));
}

/**
 * Carga una extensión individual por nombre y la registra en el registry global.
 *
 * Estrategia de resolución del objeto extensión dentro del módulo cargado:
 *   1. Intenta usar `mod.default` (export default estándar de ES modules).
 *   2. Si no hay default válido, busca `mod.<camelCase>UiExtension`
 *      (convención alternativa, ej. `planningPokerUiExtension` para `planning-poker`).
 *
 * Los errores de importación (módulo no encontrado, error de red, etc.) se
 * capturan y se registran como warnings para no interrumpir el arranque del core.
 *
 * @param name - Nombre de la extensión tal como aparece en `EXTENSION_LOADERS`
 *               (ej. `'planning-poker'`, `'wiki'`).
 */
async function loadExtension(name: string): Promise<void> {
  const loader = EXTENSION_LOADERS[name];
  if (!loader) {
    // La extensión se especificó en VITE_ENABLED_EXTENSIONS pero no existe
    // entrada en EXTENSION_LOADERS — probablemente un typo en el .env
    console.warn(
      `[FrontendExtensions] Extensión desconocida: '${name}'. ` +
      `Nombres válidos: ${Object.keys(EXTENSION_LOADERS).join(', ')}`,
    );
    return;
  }

  try {
    const mod = await loader();

    // Intentamos primero el export default; si no existe o no tiene la forma
    // esperada, buscamos la exportación nombrada con la convención <camelCase>UiExtension
    const ext =
      (mod.default as ScrumForgeFrontendExtension | undefined) ??
      (mod[toCamelCase(name) + 'UiExtension'] as ScrumForgeFrontendExtension | undefined);

    // Validación mínima: debe ser un objeto con la propiedad 'name'
    if (ext && typeof ext === 'object' && 'name' in ext) {
      frontendExtensionRegistry.register(ext);
      console.info(`[FrontendExtensions] '${name}' registrada correctamente.`);
    } else {
      console.warn(
        `[FrontendExtensions] '${name}' no exporta una extensión válida. ` +
        `Debe exportar 'default' o '${toCamelCase(name)}UiExtension'.`,
      );
    }
  } catch (err: unknown) {
    // Error de carga (chunk ausente, error de red, etc.) — el core sigue funcionando
    console.warn(`[FrontendExtensions] Error al cargar '${name}':`, err);
  }
}

/**
 * Convierte un identificador kebab-case a camelCase.
 *
 * Se usa para derivar el nombre de la exportación nombrada a partir del nombre
 * de la extensión: `'planning-poker'` → `'planningPoker'` → buscamos
 * `planningPokerUiExtension` en el módulo.
 *
 * @param kebab - Cadena en formato kebab-case (ej. `'advanced-reports'`).
 * @returns La misma cadena en camelCase (ej. `'advancedReports'`).
 *
 * @example
 * toCamelCase('billing-stripe') // → 'billingStripe'
 */
function toCamelCase(kebab: string): string {
  return kebab.replace(/-([a-z])/g, (_, c: string) => (c as string).toUpperCase());
}
