import type { StoryStatus, Priority } from '@/types/api.types';

/** Colores por estado — refleja los tokens de _variables.scss */
export const STATUS_COLORS: Record<StoryStatus, string> = {
  TODO:        '#6B7280',
  IN_PROGRESS: '#3B82F6',
  IN_REVIEW:   '#8B5CF6',
  DONE:        '#10B981',
};

/** Colores por prioridad — refleja los tokens de _variables.scss */
export const PRIORITY_COLORS: Record<Priority, string> = {
  CRITICAL: '#DC2626',
  HIGH:     '#F97316',
  MEDIUM:   '#EAB308',
  LOW:      '#6B7280',
};

/** Color hex de un estado */
export function statusColor(status: StoryStatus): string {
  return STATUS_COLORS[status] ?? '#6B7280';
}

/** Color hex de una prioridad */
export function priorityColor(priority: Priority): string {
  return PRIORITY_COLORS[priority] ?? '#6B7280';
}

/** Label en español de un estado */
export function statusLabel(status: StoryStatus): string {
  const labels: Record<StoryStatus, string> = {
    TODO:        'Pendiente',
    IN_PROGRESS: 'En progreso',
    IN_REVIEW:   'En revisión',
    DONE:        'Listo',
  };
  return labels[status] ?? status;
}

/** Label en español de una prioridad */
export function priorityLabel(priority: Priority): string {
  const labels: Record<Priority, string> = {
    CRITICAL: 'Crítica',
    HIGH:     'Alta',
    MEDIUM:   'Media',
    LOW:      'Baja',
  };
  return labels[priority] ?? priority;
}
