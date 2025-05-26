import { useTranslation } from 'react-i18next';
import type { Priority, User } from '@/types/api.types';
import styles from './BoardFilters.module.scss';

/**
 * Estado de los filtros activos en el tablero.
 * Exportado para que `BoardView` pueda tiparlo en su propio estado.
 */
export interface BoardFilterState {
  /** ID del usuario asignado por el que filtrar, o cadena vacía para todos. */
  assigneeId: string;
  /** Prioridad por la que filtrar, o cadena vacía para todas. */
  priority: Priority | '';
}

/**
 * Props del componente BoardFilters.
 */
interface BoardFiltersProps {
  /** Lista de usuarios que tienen al menos una historia en el sprint activo. */
  assignees: User[];
  /** Estado actual de los filtros. */
  filters: BoardFilterState;
  /** Callback para notificar al padre cuando cambia algún filtro. */
  onChange: (filters: BoardFilterState) => void;
  /** Total de historias sin aplicar filtros. */
  totalCount: number;
  /** Historias que pasan los filtros activos. */
  filteredCount: number;
}

/** Valores del filtro de prioridad en orden de mayor a menor urgencia. */
const PRIORITY_VALUES: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/**
 * BoardFilters
 *
 * Barra de filtros del tablero Kanban que permite acotar las tarjetas
 * visibles por responsable y prioridad.
 *
 * Es un componente completamente controlado: el estado de los filtros
 * lo gestiona `BoardView` a través de useState local (a diferencia del
 * backlog, que persiste sus filtros en el store global).
 *
 * Cuando hay algún filtro activo se muestra:
 * - Un botón para limpiar todos los filtros de un clic.
 * - Un contador "X / Y" de tarjetas filtradas vs totales.
 *
 * El selector de responsables solo se renderiza si hay al menos un
 * usuario asignado en el sprint, para no mostrar un filtro vacío.
 *
 * @param assignees - Usuarios con historias en el sprint activo.
 * @param filters - Estado actual de los filtros.
 * @param onChange - Función para actualizar los filtros en el padre.
 * @param totalCount - Total de historias antes de filtrar.
 * @param filteredCount - Historias que pasan los filtros activos.
 */
export function BoardFilters({
  assignees,
  filters,
  onChange,
  totalCount,
  filteredCount,
}: BoardFiltersProps) {
  const { t } = useTranslation();

  // Truthy si hay al menos un filtro activo
  const isFiltered = filters.assigneeId || filters.priority;

  /**
   * Actualiza un subconjunto de los filtros manteniendo el resto intacto.
   * Esto evita que cambiar un selector resetee el otro.
   */
  function update(partial: Partial<BoardFilterState>) {
    onChange({ ...filters, ...partial });
  }

  /** Resetea todos los filtros a su valor vacío inicial. */
  function clearAll() {
    onChange({ assigneeId: '', priority: '' });
  }

  return (
    <div className={styles.bar}>
      <div className={styles.filters}>
        {/* Filtro de responsable — solo visible si hay usuarios asignados en el sprint */}
        {assignees.length > 0 && (
          <select
            className={styles.select}
            value={filters.assigneeId}
            onChange={(e) => update({ assigneeId: e.target.value })}
            aria-label={t('board.assignee')}
          >
            <option value="">{t('board.allAssignees')}</option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}

        <select
          className={styles.select}
          value={filters.priority}
          onChange={(e) => update({ priority: e.target.value as Priority | '' })}
          aria-label={t('common.filter')}
        >
          <option value="">{t('board.allPriorities')}</option>
          {PRIORITY_VALUES.map((v) => (
            <option key={v} value={v}>{t(`priority.${v}`)}</option>
          ))}
        </select>

        {/* Botón de limpiar — solo visible cuando hay al menos un filtro activo */}
        {isFiltered && (
          <button className={styles.clearBtn} onClick={clearAll}>
            {t('common.filter')} ✕
          </button>
        )}
      </div>

      {/* Contador de resultados filtrados vs totales */}
      {isFiltered && (
        <span className={styles.count}>
          {filteredCount} / {totalCount}
        </span>
      )}
    </div>
  );
}
