// src/constants/routes.ts

/**
 * Mapa centralizado de todas las rutas de la aplicación.
 *
 * Las rutas públicas no requieren autenticación y son accesibles por cualquier usuario.
 * Las rutas protegidas multi-tenant incluyen el parámetro dinámico `:workspaceSlug`
 * como prefijo, lo que permite a múltiples organizaciones coexistir en la misma URL base.
 *
 * Para construir una URL con parámetros concretos usa la función `buildRoute`.
 *
 * @example
 * // Obtener la ruta del backlog de un proyecto concreto
 * buildRoute(ROUTES.BACKLOG, { workspaceSlug: 'mi-empresa', projectId: 'abc123' });
 * // => '/mi-empresa/projects/abc123/backlog'
 */
export const ROUTES = {
  // ── Rutas públicas ───────────────────────────────────────────────────────
  /** Página de inicio de sesión con email/contraseña o Google OAuth. */
  LOGIN: '/login',
  /** Formulario de registro de nueva cuenta. */
  REGISTER: '/register',
  /** Callback de OAuth (Google). React Router lo recibe y completa el flujo JWT. */
  AUTH_CALLBACK: '/auth/callback',
  /** Página de verificación de correo electrónico tras el registro. */
  VERIFY_EMAIL: '/verify-email',
  /** Formulario para solicitar el correo de recuperación de contraseña. */
  FORGOT_PASSWORD: '/forgot-password',
  /** Formulario que recibe el token de reset y permite establecer nueva contraseña. */
  RESET_PASSWORD: '/reset-password',
  /** Página que lee el token de invitación de workspace y permite aceptar o rechazar. */
  ACCEPT_INVITATION: '/accept-invitation',
  /** Wizard de configuración inicial del workspace tras el primer registro. */
  ONBOARDING: '/onboarding',
  /** Página pública de planes y precios. */
  PRICING: '/pricing',

  // ── Rutas protegidas multi-tenant — prefijo /:workspaceSlug ──────────────
  /** Raíz del workspace (redirige al dashboard). */
  WORKSPACE_ROOT: '/:workspaceSlug',
  /** Dashboard principal del workspace con resumen de sprints y métricas. */
  DASHBOARD: '/:workspaceSlug',
  /** Vista de backlog del proyecto con épicas, historias y filtros. */
  BACKLOG: '/:workspaceSlug/projects/:projectId/backlog',
  /** Vista de planificación de sprint: backlog pendiente + sprint activo. */
  SPRINT_PLANNING: '/:workspaceSlug/projects/:projectId/planning',
  /** Tablero Kanban del proyecto con columnas por estado. */
  BOARD: '/:workspaceSlug/projects/:projectId/board',
  /** Reportes y gráficos de velocidad, burndown, etc. */
  REPORTS: '/:workspaceSlug/projects/:projectId/reports',
  /** Configuración del proyecto: nombre, key, equipo, integraciones. */
  PROJECT_SETTINGS: '/:workspaceSlug/projects/:projectId/settings',
  /** Configuración del workspace: miembros, facturación, API keys. */
  WORKSPACE_SETTINGS: '/:workspaceSlug/settings',
  /** Registro de impedimentos del proyecto. */
  IMPEDIMENTS: '/:workspaceSlug/projects/:projectId/impediments',
  /** Tablero de retrospectivas del proyecto. */
  RETROSPECTIVES: '/:workspaceSlug/projects/:projectId/retrospectives',
  /** Wiki colaborativa del proyecto. */
  WIKI: '/:workspaceSlug/projects/:projectId/wiki',
  /** Reglas de automatización del proyecto. */
  AUTOMATION: '/:workspaceSlug/projects/:projectId/automation',
  /** Ruta comodín para páginas no encontradas (404). */
  NOT_FOUND: '*',
} as const;

/**
 * Construye una URL concreta a partir de una ruta de `ROUTES` y un mapa de parámetros.
 *
 * Reemplaza cada segmento dinámico (`:paramName`) por el valor correspondiente
 * del objeto `params`. Los parámetros no presentes en la ruta se ignoran.
 *
 * @param route - Ruta con marcadores de posición (p.ej. `'/:workspaceSlug/projects/:projectId/backlog'`).
 * @param params - Mapa de nombre de parámetro → valor real (p.ej. `{ workspaceSlug: 'acme', projectId: '123' }`).
 * @returns La URL con todos los marcadores reemplazados por sus valores reales.
 *
 * @example
 * buildRoute(ROUTES.BOARD, { workspaceSlug: 'acme', projectId: '42' });
 * // => '/acme/projects/42/board'
 */
export function buildRoute(
  route: string,
  params: Record<string, string>,
): string {
  // Itera sobre cada par clave/valor y sustituye `:clave` en la ruta
  return Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, value),
    route,
  );
}
