/**
 * @file ui.types.ts
 * Tipos TypeScript compartidos para el estado de la interfaz de usuario.
 *
 * Agrupa las interfaces y tipos utilizados por el store de UI (`ui.store.ts`)
 * y los distintos componentes de la aplicación para gestionar filtros, modales,
 * paneles laterales, paginación, formularios y notificaciones toast.
 */

import type { Priority, StoryStatus } from './api.types';

// ── Filtros ──────────────────────────────────────────────────────────────────

/**
 * Estado de los filtros activos en la vista de Backlog.
 * Un valor de cadena vacía `''` indica que el filtro no está aplicado.
 */
export interface BacklogFilter {
  /** ID de la épica por la que filtrar; cadena vacía significa "todas las épicas". */
  epicId: string;
  /** Estado de la historia por el que filtrar; cadena vacía significa "todos los estados". */
  status: StoryStatus | '';
  /** Prioridad por la que filtrar; cadena vacía significa "todas las prioridades". */
  priority: Priority | '';
}

/**
 * Estado de los filtros activos en el Tablero Kanban.
 * Un valor de cadena vacía `''` indica que el filtro no está aplicado.
 */
export interface BoardFilter {
  /** ID del miembro asignado por el que filtrar; cadena vacía significa "todos los miembros". */
  assigneeId: string;
  /** Prioridad por la que filtrar; cadena vacía significa "todas las prioridades". */
  priority: Priority | '';
}

// ── Modales ──────────────────────────────────────────────────────────────────

/**
 * Datos que alimentan el modal de confirmación genérico de la aplicación.
 * Se almacena en `ui.store` y el componente `ConfirmModal` lo suscribe.
 */
export interface ConfirmState {
  /** Título corto que describe la acción a confirmar. */
  title: string;
  /** Mensaje explicativo del impacto de la acción (p.ej. "Esta acción no se puede deshacer"). */
  message: string;
  /** Callback ejecutado cuando el usuario confirma la acción. Puede ser asíncrono. */
  onConfirm: () => void | Promise<void>;
}

// ── Paneles laterales ────────────────────────────────────────────────────────

/**
 * Estado de un panel lateral genérico (slide-over).
 * `entityId` identifica el elemento cargado en el panel; `null` indica que no hay nada cargado.
 */
export interface SidePanelState {
  /** Indica si el panel está visible. */
  isOpen: boolean;
  /** ID de la entidad mostrada en el panel, o `null` si el panel está vacío/cerrado. */
  entityId: string | null;
}

// ── Tablas y listas ──────────────────────────────────────────────────────────

/**
 * Configuración de ordenamiento para tablas y listas.
 *
 * @template T - Tipo del nombre de columna; por defecto `string` para uso genérico.
 *
 * @example
 * const sort: SortConfig<'title' | 'createdAt'> = { key: 'createdAt', direction: 'desc' };
 */
export interface SortConfig<T extends string = string> {
  /** Nombre del campo/columna por el que ordenar. */
  key: T;
  /** Dirección del ordenamiento: ascendente (`'asc'`) o descendente (`'desc'`). */
  direction: 'asc' | 'desc';
}

/**
 * Estado de paginación para listas que soportan navegación por páginas.
 */
export interface PaginationState {
  /** Número de página actual (base 1). */
  page: number;
  /** Número de elementos por página. */
  pageSize: number;
  /** Total de elementos disponibles (usado para calcular el número de páginas). */
  total: number;
}

// ── Formularios ──────────────────────────────────────────────────────────────

/**
 * Error de validación asociado a un campo concreto de un formulario.
 */
export interface FieldError {
  /** Nombre del campo que ha fallado la validación (coincide con la clave del objeto de valores). */
  field: string;
  /** Mensaje descriptivo del error para mostrar al usuario. */
  message: string;
}

/**
 * Estado completo de un formulario genérico.
 *
 * @template T - Tipo del objeto de valores del formulario.
 *
 * @example
 * type LoginValues = { email: string; password: string };
 * const state: FormState<LoginValues> = {
 *   values: { email: '', password: '' },
 *   errors: {},
 *   isDirty: false,
 *   isSubmitting: false,
 * };
 */
export interface FormState<T> {
  /** Valores actuales de los campos del formulario. */
  values: T;
  /** Mapa de errores de validación por nombre de campo. */
  errors: Record<string, string>;
  /** `true` si el usuario ha modificado algún campo desde la última carga/guardado. */
  isDirty: boolean;
  /** `true` mientras el formulario está en proceso de envío. */
  isSubmitting: boolean;
}

// ── Notificaciones UI ────────────────────────────────────────────────────────

/**
 * Variante visual de una notificación toast.
 * Determina el color de fondo e icono que se muestra al usuario.
 */
export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

/**
 * Representa una notificación toast activa en el stack de notificaciones.
 * El campo `id` (normalmente un UUID o timestamp) permite identificarla
 * para descartarla individualmente.
 */
export interface ToastMessage {
  /** Identificador único de la notificación (p.ej. generado con `crypto.randomUUID()`). */
  id: string;
  /** Texto de la notificación que se muestra al usuario. */
  message: string;
  /** Tipo de notificación que controla el estilo visual. */
  variant: ToastVariant;
}
