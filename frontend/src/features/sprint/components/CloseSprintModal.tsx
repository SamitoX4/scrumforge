import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/organisms/Modal/Modal';
import { Button } from '@/components/atoms/Button/Button';
import { COMPLETE_SPRINT } from '@/graphql/sprint/sprint.mutations';
import { GET_SPRINTS, GET_ACTIVE_SPRINT } from '@/graphql/sprint/sprint.queries';
import { GET_BACKLOG } from '@/graphql/backlog/backlog.queries';
import { useUIStore } from '@/store/ui.store';
import { HappinessSurvey } from '../HappinessSurvey';
import type { Sprint } from '@/types/api.types';
import styles from './CloseSprintModal.module.scss';

/**
 * Props del modal de cierre de sprint.
 */
interface CloseSprintModalProps {
  /** Sprint activo a cerrar; null desactiva el modal sin desmontarlo */
  sprint: Sprint | null;
  projectId: string;
  /** Sprints en estado PLANNING disponibles como destino de historias incompletas */
  planningSprints: Sprint[];
  onClose: () => void;
}

/**
 * @component CloseSprintModal
 * @description Modal para cerrar (completar) el sprint activo al final de la iteración.
 * Muestra un resumen de historias completadas vs. incompletas y permite al usuario
 * elegir dónde mover las historias incompletas antes de confirmar el cierre.
 *
 * Flujo de cierre:
 * 1. Se muestra el resumen estadístico del sprint (completadas / incompletas / total).
 * 2. Si hay historias incompletas, se presentan botones para moverlas a cualquiera
 *    de los sprints en PLANNING; si no se elige ninguno, quedan en el backlog.
 * 3. Al confirmar, se dispara COMPLETE_SPRINT y, si tiene éxito, se muestra
 *    `HappinessSurvey` como paso post-sprint antes de cerrar definitivamente.
 *
 * La encuesta de felicidad (Happiness Survey) es un práctica ágil que mide el
 * bienestar del equipo al final de cada sprint. Es omitible sin consecuencias.
 *
 * @param props.sprint - Sprint activo; si es null el componente no renderiza nada
 * @param props.projectId - ID del proyecto para invalidar las queries afectadas
 * @param props.planningSprints - Sprints destino para historias incompletas
 * @param props.onClose - Callback al finalizar todo el flujo (incluida la encuesta)
 */
export function CloseSprintModal({
  sprint,
  projectId,
  planningSprints,
  onClose,
}: CloseSprintModalProps) {
  const { addToast } = useUIStore();
  const { t } = useTranslation();
  // Controla si se muestra la encuesta de felicidad después del cierre exitoso
  const [showHappiness, setShowHappiness] = useState(false);
  // Guardamos nombre e ID del sprint cerrado para pasarlos a HappinessSurvey
  // porque en ese punto `sprint` ya puede haberse limpiado por el refetch
  const [closedSprintName, setClosedSprintName] = useState('');
  const [closedSprintId, setClosedSprintId] = useState('');

  const [completeSprint, { loading }] = useMutation<any>(COMPLETE_SPRINT, {
    // Invalidamos las tres queries afectadas: lista de sprints, sprint activo
    // y backlog (para mostrar las historias reubicadas)
    refetchQueries: [
      { query: GET_SPRINTS, variables: { projectId } },
      { query: GET_ACTIVE_SPRINT, variables: { projectId } },
      { query: GET_BACKLOG, variables: { projectId } },
    ],
  });

  if (!sprint) return null;

  const completed = sprint.stats.completedStories;
  const total = sprint.stats.totalStories;
  const incompleteCount = total - completed;

  /**
   * Cierra el sprint y opcionalmente mueve las historias incompletas.
   * Si `moveToSprintId` es undefined, las historias incompletas vuelven al backlog
   * sin asignación de sprint (comportamiento Scrum estándar).
   *
   * @param moveToSprintId - ID del sprint destino para historias incompletas; undefined = backlog
   */
  async function handleClose(moveToSprintId?: string) {
    try {
      await completeSprint({
        variables: {
          id: sprint!.id,
          moveIncompleteToSprintId: moveToSprintId,
        },
      });
      addToast(t('common.success'), 'success');
      // Guardamos el contexto del sprint cerrado antes del refetch
      setClosedSprintName(sprint!.name);
      setClosedSprintId(sprint!.id);
      // Transicionamos a la encuesta de felicidad como paso post-cierre
      setShowHappiness(true);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error'), 'error');
    }
  }

  /**
   * Finaliza el flujo completo (modal + encuesta) y llama al callback del padre.
   * Se invoca tanto al enviar la encuesta como al omitirla.
   */
  function handleHappinessFinished() {
    setShowHappiness(false);
    onClose();
  }

  if (showHappiness) {
    return (
      <HappinessSurvey
        sprintName={closedSprintName}
        sprintId={closedSprintId}
        onSubmit={(_rating, _comment) => handleHappinessFinished()}
        onSkip={handleHappinessFinished}
      />
    );
  }

  return (
    <Modal
      isOpen={!!sprint}
      onClose={onClose}
      title={t('sprint.closeTitle', { name: sprint.name })}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={() => handleClose()}
            loading={loading}
          >
            {t('sprint.close')}
          </Button>
        </>
      }
    >
      <div className={styles.content}>
        {/* Summary */}
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue} style={{ color: '#10B981' }}>{completed}</span>
            <span className={styles.statLabel}>{t('sprint.completedStories')}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue} style={{ color: '#EF4444' }}>{incompleteCount}</span>
            <span className={styles.statLabel}>{t('sprint.incompleteStories')}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{total}</span>
            <span className={styles.statLabel}>{t('sprint.totalStories')}</span>
          </div>
        </div>

        {incompleteCount === 0 ? (
          <p className={styles.allDone}>
            {t('sprint.allDone')}
          </p>
        ) : (
          <div className={styles.incompleteSection}>
            <p className={styles.incompleteMessage}
              dangerouslySetInnerHTML={{ __html: t('sprint.incompleteMessage', { count: incompleteCount }) }}
            />

            {planningSprints.length > 0 && (
              <div className={styles.moveOptions}>
                <p className={styles.moveLabel}>{t('sprint.moveToPlanning')}</p>
                <div className={styles.sprintButtons}>
                  {planningSprints.map((s) => (
                    <button
                      key={s.id}
                      className={styles.sprintBtn}
                      onClick={() => handleClose(s.id)}
                      disabled={loading}
                    >
                      {s.name}
                      <span className={styles.sprintBtnCount}>{s.stats.totalStories} {t('sprint.stories')}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
