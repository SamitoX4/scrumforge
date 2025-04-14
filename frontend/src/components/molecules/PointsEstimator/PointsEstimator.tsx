import clsx from 'clsx';
import { FIBONACCI_SEQUENCE } from '@/utils/story-points.utils';
import styles from './PointsEstimator.module.scss';

/**
 * Se toman los primeros 7 valores de Fibonacci (1, 2, 3, 5, 8, 13, 21).
 * Esto cubre el rango práctico de la mayoría de los equipos Scrum sin
 * mostrar valores tan grandes que raramente se usan (34, 55...).
 */
const POINTS = FIBONACCI_SEQUENCE.slice(0, 7) as readonly number[];

/**
 * Props del componente PointsEstimator.
 *
 * @property value    - Valor actualmente seleccionado, o null si la historia no está estimada.
 * @property onChange - Callback invocado con el nuevo valor al seleccionar, o null al deseleccionar.
 * @property disabled - Cuando es true, todos los botones quedan inactivos (modo solo-lectura).
 */
interface PointsEstimatorProps {
  /** Currently selected points value (null = unestimated). */
  value: number | null;
  /** Called when the user selects or deselects a value. */
  onChange: (points: number | null) => void;
  disabled?: boolean;
}

/**
 * PointsEstimator — selector visual de story points basado en la secuencia de Fibonacci.
 *
 * Cada botón representa un valor de Fibonacci. Si el usuario hace clic en el valor
 * ya seleccionado, se deselecciona (toggle → null), permitiendo marcar la historia
 * como "sin estimar". El botón "?" siempre limpia la selección explícitamente.
 *
 * Accesibilidad:
 * - `role="group"` con `aria-label` agrupa los botones semánticamente.
 * - `aria-pressed` en cada botón indica su estado seleccionado/no-seleccionado.
 *
 * Reemplaza los controles ad-hoc de selector de puntos dispersos en el código base,
 * garantizando consistencia visual y comportamiento uniforme.
 *
 * @example
 * <PointsEstimator
 *   value={story.points}
 *   onChange={(pts) => updateStory({ points: pts })}
 *   disabled={!canEdit}
 * />
 */
export function PointsEstimator({ value, onChange, disabled = false }: PointsEstimatorProps) {
  function handleClick(n: number) {
    // Si el valor ya está seleccionado, hacer clic de nuevo lo deselecciona (→ null)
    onChange(value === n ? null : n);
  }

  return (
    <div className={styles.grid} role="group" aria-label="Story points">
      {POINTS.map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => handleClick(n)}
          className={clsx(styles.btn, value === n && styles['btn--active'])}
          // aria-pressed indica si este valor es el actualmente seleccionado
          aria-pressed={value === n}
        >
          {n}
        </button>
      ))}

      {/* Botón "?" para limpiar la estimación — indica que la historia no está estimada */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(null)}
        className={clsx(styles.btn, styles['btn--clear'], value === null && styles['btn--active'])}
        aria-pressed={value === null}
        aria-label="Sin estimar"
      >
        ?
      </button>
    </div>
  );
}
