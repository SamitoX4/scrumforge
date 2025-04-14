import clsx from 'clsx';
import type { Priority } from '@/types/api.types';
import styles from './PrioritySelector.module.scss';

/**
 * Definición estática de las opciones de prioridad con sus colores de indicador.
 * Los colores se pasan como CSS custom property `--priority-color` al elemento
 * para que el SCSS pueda usarlos sin hardcodear valores en la hoja de estilos.
 */
const PRIORITIES: Array<{ value: Priority; label: string; color: string }> = [
  { value: 'CRITICAL', label: 'Crítica', color: '#DC2626' },
  { value: 'HIGH',     label: 'Alta',    color: '#F97316' },
  { value: 'MEDIUM',   label: 'Media',   color: '#EAB308' },
  { value: 'LOW',      label: 'Baja',    color: '#6B7280' },
];

/**
 * Props del componente PrioritySelector.
 *
 * @property value    - Prioridad actualmente seleccionada.
 * @property onChange - Callback invocado con la nueva prioridad cuando el usuario selecciona una opción.
 * @property disabled - Cuando es true, todos los botones quedan inactivos (modo solo-lectura).
 */
interface PrioritySelectorProps {
  /** Currently selected priority. */
  value: Priority;
  /** Called with the new priority when the user selects one. */
  onChange: (priority: Priority) => void;
  disabled?: boolean;
}

/**
 * PrioritySelector — cuadrícula visual de opciones de prioridad con indicadores de color.
 *
 * Reemplaza los `<select>` de prioridad en formularios de historias y tareas,
 * ofreciendo una experiencia más visual e intuitiva gracias al punto de color
 * que identifica cada nivel de prioridad.
 *
 * El color se inyecta como CSS custom property (`--priority-color`) en cada botón,
 * permitiendo que el SCSS lo use para el indicador sin duplicar los valores hex.
 *
 * Accesibilidad:
 * - `role="group"` con `aria-label` agrupa las opciones semánticamente.
 * - `aria-pressed` indica cuál opción está activa.
 *
 * @example
 * <PrioritySelector
 *   value={story.priority}
 *   onChange={(priority) => updateStory({ priority })}
 *   disabled={!canEdit}
 * />
 */
export function PrioritySelector({ value, onChange, disabled = false }: PrioritySelectorProps) {
  return (
    <div className={styles.grid} role="group" aria-label="Prioridad">
      {PRIORITIES.map((p) => (
        <button
          key={p.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(p.value)}
          className={clsx(styles.option, value === p.value && styles['option--selected'])}
          // aria-pressed permite a los lectores de pantalla saber cuál opción está activa
          aria-pressed={value === p.value}
          // El color se pasa como CSS variable para que el SCSS lo use en el indicador visual
          style={{ '--priority-color': p.color } as React.CSSProperties}
        >
          {/* Punto de color — puramente decorativo, el color lo toma de --priority-color */}
          <span className={styles.dot} />
          <span className={styles.label}>{p.label}</span>
        </button>
      ))}
    </div>
  );
}
