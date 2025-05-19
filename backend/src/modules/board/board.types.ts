/**
 * Representa una columna del tablero Kanban con su configuración visual y funcional.
 * Las columnas se guardan en el campo JSON `Project.settings` bajo la clave
 * `boardColumns`, lo que evita una tabla separada y simplifica las migraciones.
 */
export interface BoardColumn {
  /** Identificador estable de la columna; se usa como clave en operaciones de drag & drop */
  id: string;
  /** Título visible en la cabecera de la columna (ej. "En progreso") */
  title: string;
  /** Mapea a StoryStatus en la base de datos; filtra las historias que pertenecen a esta columna */
  status: string;
  /** Color hexadecimal de la cabecera (opcional; se usa para distinguir columnas visualmente) */
  color?: string;
  /** Posición de izquierda a derecha en el tablero (0 = primera columna) */
  order: number;
  /** Límite de trabajo en progreso (WIP); undefined significa sin límite */
  wipLimit?: number;
}

/**
 * Estructura del objeto JSON almacenado en `Project.settings` para la configuración del tablero.
 * Se usa para hacer parsing tipado al leer y escribir la configuración de columnas.
 */
export interface BoardSettings {
  /** Lista de columnas personalizadas del tablero */
  boardColumns: BoardColumn[];
}

/**
 * Columnas por defecto del tablero Kanban.
 * Se usan cuando un proyecto nuevo no tiene columnas personalizadas configuradas,
 * garantizando que el tablero siempre tenga contenido desde el primer acceso.
 * Los valores de `status` equivalen exactamente a los valores del enum StoryStatus de Prisma.
 */
export const DEFAULT_BOARD_COLUMNS: BoardColumn[] = [
  { id: 'TODO',        title: 'Por hacer',    status: 'TODO',        color: '#6B7280', order: 0 },
  { id: 'IN_PROGRESS', title: 'En progreso',  status: 'IN_PROGRESS', color: '#3B82F6', order: 1 },
  { id: 'IN_REVIEW',   title: 'En revisión',  status: 'IN_REVIEW',   color: '#8B5CF6', order: 2 },
  { id: 'DONE',        title: 'Listo',        status: 'DONE',        color: '#10B981', order: 3 },
];
