import { useTranslation } from 'react-i18next';
import type { Epic, Priority, StoryStatus } from '@/types/api.types';
import type { BacklogFilterState } from '@/store/ui.store';
import styles from './BacklogFilters.module.scss';

// Re-exportar el tipo para que los consumidores puedan importarlo desde aquí
export type { BacklogFilterState };

/**
 * Props del componente BacklogFilters.
 */
interface BacklogFiltersProps {
  /** Lista de épicas disponibles para el filtro de épica. */
  epics: Epic[];
  /** Estado actual de los filtros aplicados. */
  filters: BacklogFilterState;
  /** Callback para notificar al padre cuando cambia algún filtro. */
  onChange: (filters: BacklogFilterState) => void;
  /** Número total de historias sin aplicar filtros. */
  totalCount: number;
  /** Número de historias que pasan los filtros actuales. */
  filteredCount: number;
}

/** Valores posibles del filtro de estado, en orden lógico de flujo. */
const STATUS_VALUES: StoryStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

/** Valores posibles del filtro de prioridad, de mayor a menor urgencia. */
const PRIORITY_VALUES: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/**
 * BacklogFilters
 *
 * Barra de filtros del backlog que permite acotar las historias visibles
 * por épica, estado y prioridad.
 *
 * El estado de los filtros vive en el store global (`ui.store`) para que
 * persista al navegar entre vistas. Este componente es completamente
 * controlado: recibe el estado y notifica cambios mediante `onChange`.
 *
 * Cuando hay algún filtro activo se muestra:
 * - Un botón "Limpiar filtros" para resetear todos a vacío en un clic.
 * - Un contador "X / Y" con los resultados filtrados vs totales.
 *
 * @param epics - Épicas del proyecto para el selector (se oculta si no hay épicas).
 * @param filters - Estado actual de los filtros.
 * @param onChange - Función para actualizar los filtros en el padre.
 * @param totalCount - Total de historias antes de filtrar.
 * @param filteredCount - Historias que pasan los filtros activos.
 */
export function BacklogFilters({
  epics,
  filters,
  onChange,
  totalCount,
  filteredCount,
}: BacklogFiltersProps) {
  const { t } = useTranslation();

  // Truthy si al menos uno de los filtros tiene valor seleccionado
  const isFiltered = filters.epicId || filters.status || filters.priority;

  /**
   * Actualiza solo las claves indicadas manteniendo el resto intacto.
   * Permite que cada selector actualice solo su campo sin resetear los demás.
   */
  function update(partial: Partial<BacklogFilterState>) {
    onChange({ ...filters, ...partial });
  }

  /** Resetea todos los filtros a su valor vacío inicial. */
  function clearAll() {
    onChange({ epicId: '', status: '', priority: '' });
  }

  return (
    <div className={styles.bar}>
      <div className={styles.filters}>
        {/* El filtro de épica solo se muestra si el proyecto tiene épicas creadas */}
        {epics.length > 0 && (
          <select
            className={styles.select}
            value={filters.epicId}
            onChange={(e) => update({ epicId: e.target.value })}
            aria-label={t('board.allEpics')}
          >
            <option value="">{t('board.allEpics')}</option>
            {epics.map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
        )}

        <select
          className={styles.select}
          value={filters.status}
          onChange={(e) => update({ status: e.target.value as StoryStatus | '' })}
          aria-label={t('board.allStatuses')}
        >
          <option value="">{t('board.allStatuses')}</option>
          {STATUS_VALUES.map((v) => (
            <option key={v} value={v}>{t(`status.${v}`)}</option>
          ))}
        </select>

        <select
          className={styles.select}
          value={filters.priority}
          onChange={(e) => update({ priority: e.target.value as Priority | '' })}
          aria-label={t('board.allPriorities')}
        >
          <option value="">{t('board.allPriorities')}</option>
          {PRIORITY_VALUES.map((v) => (
            <option key={v} value={v}>{t(`priority.${v}`)}</option>
          ))}
        </select>

        {/* El botón de limpiar solo aparece cuando hay filtros activos */}
        {isFiltered && (
          <button className={styles.clearBtn} onClick={clearAll}>
            {t('board.clearFilters')}
          </button>
        )}
      </div>

      {/* Contador de resultados — solo visible cuando hay filtros activos */}
      {isFiltered && (
        <span className={styles.count}>
          {filteredCount} / {totalCount}
        </span>
      )}
    </div>
  );
}
