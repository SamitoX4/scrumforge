import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/atoms/Button/Button';
import { ConfirmDialog } from '@/components/molecules/ConfirmDialog/ConfirmDialog';
import { GET_SPRINTS } from '@/graphql/sprint/sprint.queries';
import { DELETE_USER_STORY, MOVE_TO_SPRINT } from '@/graphql/backlog/backlog.mutations';
import { GET_BACKLOG } from '@/graphql/backlog/backlog.queries';
import { useUIStore } from '@/store/ui.store';
import type { Sprint } from '@/types/api.types';
import styles from './BacklogToolbar.module.scss';

/**
 * Props del componente BacklogToolbar.
 */
interface BacklogToolbarProps {
  /** Identificador del proyecto actual. */
  projectId: string;
  /** Conjunto de IDs de las historias actualmente seleccionadas. */
  selectedIds: Set<string>;
  /** Número total de historias visibles (usado para el checkbox "Seleccionar todo"). */
  totalCount: number;
  /** Callback para seleccionar todas las historias visibles. */
  onSelectAll: () => void;
  /** Callback para deseleccionar todas las historias. */
  onDeselectAll: () => void;
  /** Callback invocado tras completar una acción masiva (mover o eliminar). */
  onActionComplete: () => void;
}

/**
 * BacklogToolbar
 *
 * Barra de acciones masivas que aparece cuando el usuario selecciona al menos
 * una historia en el backlog. Permite:
 * - Ver cuántas historias están seleccionadas vs el total.
 * - Seleccionar/deseleccionar todas con un checkbox indeterminado.
 * - Mover las historias seleccionadas a un sprint (PLANNING o ACTIVE).
 * - Mover las historias seleccionadas de vuelta al backlog (sprintId = null).
 * - Eliminar las historias seleccionadas con confirmación previa.
 *
 * El componente se oculta (`return null`) cuando no hay historias seleccionadas,
 * para no ocupar espacio en el layout del backlog.
 *
 * Las acciones masivas se ejecutan en paralelo con `Promise.all` para mayor
 * eficiencia, aunque el servidor procesa cada mutación individualmente.
 *
 * @param projectId - ID del proyecto para filtrar sprints disponibles.
 * @param selectedIds - IDs de historias seleccionadas.
 * @param totalCount - Total de historias en la vista filtrada actual.
 * @param onSelectAll - Marca todas las historias como seleccionadas.
 * @param onDeselectAll - Limpia la selección.
 * @param onActionComplete - Se llama después de completar cualquier acción.
 */
export function BacklogToolbar({
  projectId,
  selectedIds,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onActionComplete,
}: BacklogToolbarProps) {
  const [showSprintMenu, setShowSprintMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Estado de carga local para bloquear los botones durante las operaciones masivas
  const [actionLoading, setActionLoading] = useState(false);
  const { addToast } = useUIStore();
  const { t } = useTranslation();

  // Obtener los sprints del proyecto para el menú "Mover a sprint"
  const { data: sprintsData } = useQuery<any>(GET_SPRINTS, {
    variables: { projectId },
    skip: !projectId,
  });

  const [moveToSprint] = useMutation<any>(MOVE_TO_SPRINT, {
    // Refrescar el backlog completo tras mover para reflejar los cambios de sprint
    refetchQueries: [{ query: GET_BACKLOG, variables: { projectId } }],
  });

  const [deleteStory] = useMutation<any>(DELETE_USER_STORY, {
    refetchQueries: [{ query: GET_BACKLOG, variables: { projectId } }],
  });

  // Solo mostrar sprints en los que tiene sentido agregar historias (no completados)
  const planningOrActiveSprints: Sprint[] = (sprintsData?.sprints ?? []).filter(
    (s: Sprint) => s.status === 'PLANNING' || s.status === 'ACTIVE',
  );

  const count = selectedIds.size;
  // `allSelected` es true cuando todas las historias visibles están seleccionadas
  const allSelected = count === totalCount && totalCount > 0;
  // `someSelected` activa el estado indeterminado del checkbox
  const someSelected = count > 0 && count < totalCount;

  /**
   * Mueve todas las historias seleccionadas al sprint indicado.
   * Si `sprintId` es null, las devuelve al backlog sin sprint.
   * Las mutaciones se lanzan en paralelo para mayor rendimiento.
   */
  async function handleMoveToSprint(sprintId: string | null) {
    setShowSprintMenu(false);
    setActionLoading(true);
    try {
      await Promise.all(
        [...selectedIds].map((id) => moveToSprint({ variables: { storyId: id, sprintId } })),
      );
      addToast(t('common.success'), 'success');
      onDeselectAll();
      onActionComplete();
    } catch {
      addToast(t('common.error'), 'error');
    } finally {
      setActionLoading(false);
    }
  }

  /**
   * Elimina todas las historias seleccionadas de forma paralela.
   * Se invoca desde el diálogo de confirmación para evitar borrados accidentales.
   */
  async function handleDelete() {
    setConfirmDelete(false);
    setActionLoading(true);
    try {
      await Promise.all([...selectedIds].map((id) => deleteStory({ variables: { id } })));
      addToast(t('common.success'), 'success');
      onDeselectAll();
      onActionComplete();
    } catch {
      addToast(t('common.error'), 'error');
    } finally {
      setActionLoading(false);
    }
  }

  // La barra solo se muestra cuando hay al menos una historia seleccionada
  if (count === 0) return null;

  return (
    <>
      <div className={styles.toolbar} role="toolbar" aria-label={t('backlog.deleteStories')}>
        {/* Checkbox de selección total con estado indeterminado cuando solo hay una selección parcial */}
        <label className={styles.selectAll}>
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              // La propiedad `indeterminate` no es un atributo HTML estándar;
              // debe manipularse directamente en el DOM via ref
              if (el) el.indeterminate = someSelected;
            }}
            onChange={() => (allSelected ? onDeselectAll() : onSelectAll())}
            aria-label={t('common.all')}
          />
          <span className={styles.count}>
            {count} de {totalCount} seleccionada{count !== 1 ? 's' : ''}
          </span>
        </label>

        <div className={styles.actions}>
          {/* Menú desplegable de sprints — se abre al hacer clic en el botón "Mover a sprint" */}
          <div className={styles.sprintDropdown}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowSprintMenu((v) => !v)}
              disabled={actionLoading}
            >
              {t('backlog.moveToSprint')}
            </Button>
            {showSprintMenu && (
              <ul className={styles.menu} role="menu">
                {/* Opción para devolver al backlog (sin sprint) */}
                <li role="none">
                  <button
                    role="menuitem"
                    className={styles.menuItem}
                    onClick={() => handleMoveToSprint(null)}
                  >
                    {t('backlog.removeFromSprint')}
                  </button>
                </li>
                {planningOrActiveSprints.length === 0 && (
                  <li className={styles.menuEmpty}>{t('backlog.noSprintsAvailable')}</li>
                )}
                {planningOrActiveSprints.map((sprint) => (
                  <li key={sprint.id} role="none">
                    <button
                      role="menuitem"
                      className={styles.menuItem}
                      onClick={() => handleMoveToSprint(sprint.id)}
                    >
                      {sprint.name}
                      {/* Badge "ACTIVO" para distinguir el sprint en curso */}
                      {sprint.status === 'ACTIVE' && (
                        <span className={styles.activeBadge}>{t('status.ACTIVE')}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Botón de eliminar — abre el diálogo de confirmación antes de ejecutar */}
          <Button
            size="sm"
            variant="danger"
            onClick={() => setConfirmDelete(true)}
            disabled={actionLoading}
          >
            {t('common.delete')}
          </Button>

          <Button size="sm" variant="secondary" onClick={onDeselectAll} disabled={actionLoading}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>

      {/* Diálogo de confirmación para la eliminación masiva */}
      <ConfirmDialog
        isOpen={confirmDelete}
        title={t('backlog.deleteStories')}
        message={t('backlog.deleteConfirm', { count })}
        confirmLabel={t('common.delete')}
        variant="danger"
        loading={actionLoading}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
