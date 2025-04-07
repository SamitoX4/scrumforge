/**
 * @file pages/index.ts
 * Barrel de re-exportaciones canónicas de las páginas de la aplicación.
 *
 * Centraliza los imports para que el resto de la app (principalmente `App.tsx`)
 * pueda importar cualquier página desde `@/pages` en lugar de usar rutas relativas
 * hacia cada archivo individual.
 *
 * Las páginas se cargan de forma lazy en `App.tsx` mediante `React.lazy()`,
 * por lo que este barrel no introduce carga síncrona adicional.
 *
 * @example
 * // En App.tsx
 * const DashboardPage = React.lazy(() => import('@/pages').then(m => ({ default: m.DashboardPage })));
 */

// ── Páginas públicas (no requieren autenticación) ────────────────────────────
/** Página de inicio de sesión. */
export { default as LoginPage } from './LoginPage';
/** Página de registro de nueva cuenta. */
export { default as RegisterPage } from './RegisterPage';

// ── Páginas protegidas (requieren autenticación y workspace) ─────────────────
/** Dashboard principal del workspace. */
export { default as DashboardPage } from './DashboardPage';
/** Vista de backlog del proyecto. */
export { default as BacklogPage } from './BacklogPage';
/** Tablero Kanban del proyecto. */
export { default as BoardPage } from './BoardPage';
/** Vista de planificación del sprint. */
export { default as SprintPlanningPage } from './SprintPlanningPage';
/** Reportes y métricas del proyecto. */
export { default as ReportsPage } from './ReportsPage';
/** Configuración del proyecto. */
export { default as ProjectSettingsPage } from './ProjectSettingsPage';
/** Configuración del workspace. */
export { default as WorkspaceSettingsPage } from './WorkspaceSettingsPage';

// ── Páginas de error ─────────────────────────────────────────────────────────
/** Página de error 404 (ruta no encontrada). */
export { default as NotFoundPage } from './NotFoundPage';
