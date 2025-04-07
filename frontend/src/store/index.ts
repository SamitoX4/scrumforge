/**
 * @file store/index.ts
 * @description Punto de entrada único para los stores globales de Zustand.
 *
 * Centralizar las re-exportaciones aquí permite que los componentes importen
 * cualquier store desde `@/store` en lugar de rutas profundas, y facilita
 * reorganizar los archivos internos sin romper los imports en toda la app.
 *
 * Stores disponibles:
 * - `useAuthStore`  — sesión del usuario, tokens JWT y workspace activo.
 * - `useUIStore`    — sidebar, modales, toasts, tema, filtros del backlog.
 * - `useBoardStore` — estado optimista del tablero Kanban durante drag & drop.
 */
export { useAuthStore } from './auth.store';
export { useUIStore } from './ui.store';
export { useBoardStore } from './board.store';

/**
 * Re-exportar tipos de UI para que los consumidores no necesiten
 * importar directamente desde `ui.store.ts`.
 */
export type { ToastType, Toast } from './ui.store';
