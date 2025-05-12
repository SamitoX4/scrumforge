import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/organisms/Modal/Modal';
import { Button } from '@/components/atoms/Button/Button';
import { FormField } from '@/components/molecules/FormField/FormField';
import { Input } from '@/components/atoms/Input/Input';
import { START_SPRINT } from '@/graphql/sprint/sprint.mutations';
import { GET_SPRINTS, GET_ACTIVE_SPRINT } from '@/graphql/sprint/sprint.queries';
import { useUIStore } from '@/store/ui.store';
import type { Sprint } from '@/types/api.types';
import styles from './StartSprintModal.module.scss';

/**
 * Props del modal de inicio de sprint.
 */
interface StartSprintModalProps {
  /** Sprint a iniciar; null desactiva el modal */
  sprint: Sprint | null;
  projectId: string;
  onClose: () => void;
}

/**
 * Formatea una fecha como string ISO local (YYYY-MM-DD) compatible con
 * el input[type="date"] de HTML. Se usa toISOString y se corta a 10 caracteres
 * para evitar problemas de zona horaria al convertir a Date de nuevo.
 *
 * @param date - Fecha a formatear
 * @returns String en formato YYYY-MM-DD
 */
function formatDateLocal(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * @component StartSprintModal
 * @description Modal para iniciar un sprint en estado PLANNING. Permite establecer
 * el objetivo del sprint y las fechas de inicio/fin antes de activarlo.
 *
 * Validaciones y avisos:
 * - Sprints menores de 7 días muestran una advertencia (demasiado cortos para Scrum)
 * - Sprints mayores de 28 días muestran una advertencia (recomendación de máx. 4 semanas)
 * - Sprint sin objetivo muestra un aviso informativo (no bloquea el inicio)
 *
 * Por defecto, la fecha de inicio es hoy y la fecha de fin es 2 semanas después,
 * siguiendo el estándar de sprint de 2 semanas en Scrum.
 *
 * El resumen (historias/puntos) se muestra como contexto para que el equipo
 * confirme que el sprint está correctamente planificado antes de arrancarlo.
 *
 * @param props.sprint - Sprint a iniciar (debe estar en estado PLANNING)
 * @param props.projectId - ID del proyecto para invalidar las queries de sprint
 * @param props.onClose - Callback al cancelar o tras inicio exitoso
 */
export function StartSprintModal({ sprint, projectId, onClose }: StartSprintModalProps) {
  const { addToast } = useUIStore();
  const { t } = useTranslation();

  const today = new Date();
  // Fecha fin predeterminada: 2 semanas (en milisegundos) desde hoy
  const twoWeeks = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

  // Prellenamos el objetivo con el valor existente del sprint si lo tiene
  const [goal, setGoal] = useState(sprint?.goal ?? '');
  const [startDate, setStartDate] = useState(formatDateLocal(today));
  const [endDate, setEndDate] = useState(formatDateLocal(twoWeeks));

  const [startSprint, { loading }] = useMutation<any>(START_SPRINT, {
    // Invalidamos tanto la lista de sprints como el sprint activo para que
    // el tablero y la vista de sprint detecten el nuevo sprint activo
    refetchQueries: [
      { query: GET_SPRINTS, variables: { projectId } },
      { query: GET_ACTIVE_SPRINT, variables: { projectId } },
    ],
  });

  // Calculamos la duración en días para mostrar advertencias de duración anómala.
  // Se redondea para absorber diferencias de horas debidas al horario de verano.
  const durationDays = Math.round(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24),
  );
  // Solo se muestra un aviso si la duración es fuera del rango recomendado (7-28 días)
  const durationWarning =
    durationDays < 7 ? t('sprint.shortWarning') :
    durationDays > 28 ? t('sprint.longWarning') :
    null;

  /**
   * Inicia el sprint con los datos del formulario.
   * Las fechas se convierten a ISO 8601 completo para el servidor.
   * El objetivo se omite si está vacío (el sprint puede iniciarse sin goal).
   */
  async function handleConfirm() {
    if (!sprint) return;
    try {
      await startSprint({
        variables: {
          id: sprint.id,
          input: {
            goal: goal.trim() || undefined,
            startDate: new Date(startDate).toISOString(),
            endDate: new Date(endDate).toISOString(),
          },
        },
      });
      addToast(t('common.success'), 'success');
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error'), 'error');
    }
  }

  // Stats del sprint para mostrar el resumen previo al inicio
  const storiesCount = sprint?.stats?.totalStories ?? 0;
  const pointsCount = sprint?.stats?.totalPoints ?? 0;

  return (
    <Modal
      isOpen={!!sprint}
      onClose={onClose}
      title={t('sprint.startTitle', { name: sprint?.name ?? 'sprint' })}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirm} loading={loading}>
            {t('sprint.start')}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        {storiesCount > 0 && (
          <div className={styles.summary}>
            <span className={styles.summaryItem}>
              <strong>{storiesCount}</strong> {t('sprint.stories')}
            </span>
            <span className={styles.summaryDivider}>·</span>
            <span className={styles.summaryItem}>
              <strong>{pointsCount}</strong> {t('story.points')}
            </span>
          </div>
        )}

        <FormField
          label={t('sprint.goalLabel')}
          htmlFor="sprint-goal"
          hint={!goal.trim() ? undefined : t('sprint.goalHint')}
        >
          <Input
            id="sprint-goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder={t('sprint.goalPlaceholder')}
            autoFocus
          />
        </FormField>

        {!goal.trim() && (
          <div className={styles.warning} role="note">
            {t('sprint.noGoalWarning')}
          </div>
        )}

        <div className={styles.dates}>
          <FormField label={t('sprint.startDate')} htmlFor="sprint-start" required>
            <Input
              id="sprint-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </FormField>
          <FormField label={t('sprint.endDate')} htmlFor="sprint-end" required>
            <Input
              id="sprint-end"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </FormField>
        </div>

        {durationWarning && (
          <div className={styles.warning} role="note">
            ⚠️ {durationWarning}
          </div>
        )}
      </div>
    </Modal>
  );
}
