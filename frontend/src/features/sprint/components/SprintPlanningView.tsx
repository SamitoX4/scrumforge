import { useQuery, useMutation } from '@apollo/client/react';
import { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { GET_SPRINTS } from '@/graphql/sprint/sprint.queries';
import { GET_BACKLOG } from '@/graphql/backlog/backlog.queries';
import { GET_VELOCITY } from '@/graphql/reports/reports.queries';
import { CREATE_SPRINT } from '@/graphql/sprint/sprint.mutations';
import { MOVE_TO_SPRINT } from '@/graphql/backlog/backlog.mutations';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { Button } from '@/components/atoms/Button/Button';
import { Badge } from '@/components/atoms/Badge/Badge';
import { Modal } from '@/components/organisms/Modal/Modal';
import { FormField } from '@/components/molecules/FormField/FormField';
import { Input } from '@/components/atoms/Input/Input';
import { StartSprintModal } from './StartSprintModal';
import { CloseSprintModal } from './CloseSprintModal';
import { PlanningStoryCard } from './PlanningStoryCard';
import { SprintDropZone } from './SprintDropZone';
import { ExtensionSlot } from '@/extensions/ExtensionSlot';
import { frontendExtensionRegistry } from '@/extensions/extension-registry';
import { useUIStore } from '@/store/ui.store';
import { useTranslation } from 'react-i18next';
import type { Sprint, UserStory } from '@/types/api.types';
import styles from './SprintPlanningView.module.scss';

/**
 * SprintPlanningView
 *
 * Vista principal de planificación de sprints. Presenta un layout de dos columnas:
 * - Izquierda: backlog del proyecto con las historias sin sprint asignado.
 * - Derecha: lista de sprints (en cualquier estado) con zonas de drop.
 *
 * Funcionalidad de arrastrar y soltar (dnd-kit):
 * - Las historias del backlog son elementos arrastrables (`PlanningStoryCard`).
 * - Cada sprint en estado PLANNING es una zona receptora (`SprintDropZone`).
 * - Al soltar, se llama a `handleMoveToSprint` que ejecuta la mutación GraphQL
 *   y refresca tanto el backlog como los sprints.
 * - Durante el arrastre, `DragOverlay` muestra una copia flotante de la tarjeta.
 *
 * Barra de capacidad:
 * - Solo visible en sprints PLANNING cuando hay velocidad histórica disponible.
 * - El color cambia de verde → ámbar → rojo según el porcentaje de capacidad usado.
 *
 * Extensibilidad:
 * - El panel de Planning Poker se inyecta mediante el slot 'planning-poker-panel'
 *   del registro de extensiones. Solo se renderiza si la extensión está registrada.
 */
export default function SprintPlanningView() {
  const { projectId } = useCurrentProject();
  const { addToast } = useUIStore();
  const { t } = useTranslation();

  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [sprintName, setSprintName] = useState('');
  const [sprintGoal, setSprintGoal] = useState('');
  const [sprintToStart, setSprintToStart] = useState<Sprint | null>(null);
  const [sprintToClose, setSprintToClose] = useState<Sprint | null>(null);
  const [activeStory, setActiveStory] = useState<UserStory | null>(null);

  // El sensor requiere mover el puntero al menos 8 px antes de iniciar el drag,
  // evitando activaciones accidentales en clics simples sobre las tarjetas.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // `refetch` manual necesario porque MOVE_TO_SPRINT no puede usar refetchQueries
  // para ambas queries a la vez (requiere refrescar backlog Y sprints simultáneamente).
  const { data: sprintsData, loading: sprintsLoading, refetch: refetchSprints } = useQuery<any>(
    GET_SPRINTS, { variables: { projectId }, skip: !projectId },
  );
  const { data: backlogData, loading: backlogLoading, refetch: refetchBacklog } = useQuery<any>(
    GET_BACKLOG, { variables: { projectId }, skip: !projectId },
  );
  // Se consultan los últimos 3 sprints completados para calcular la velocidad promedio del equipo.
  const { data: velocityData } = useQuery<any>(
    GET_VELOCITY, { variables: { projectId, lastSprints: 3 }, skip: !projectId },
  );

  const [createSprint, { loading: creating }] = useMutation<any>(CREATE_SPRINT, {
    refetchQueries: [{ query: GET_SPRINTS, variables: { projectId } }],
  });
  const [moveToSprint] = useMutation<any>(MOVE_TO_SPRINT);

  // Mostrar spinner global mientras se cargan los datos iniciales de la vista
  if (sprintsLoading || backlogLoading) {
    return <div className={styles.loading}><Spinner size="lg" /></div>;
  }

  const sprints: Sprint[] = sprintsData?.sprints ?? [];
  const backlog: UserStory[] = backlogData?.backlog ?? [];
  // Solo los sprints en planificación admiten recibir historias por drag-and-drop
  const planningSprints = sprints.filter((s) => s.status === 'PLANNING');
  // 0 si no hay historial de velocidad; en ese caso no se muestra la barra de capacidad
  const averageVelocity: number = velocityData?.velocityReport?.averageVelocity ?? 0;

  /**
   * Crea un nuevo sprint con el nombre y objetivo introducidos en el modal.
   * El objetivo es opcional; si está vacío no se incluye en el input de la mutación.
   */
  async function handleCreateSprint() {
    if (!sprintName.trim()) return;
    try {
      await createSprint({
        variables: {
          input: {
            name: sprintName,
            projectId,
            // Solo incluir `goal` si el usuario introdujo algún texto
            ...(sprintGoal.trim() ? { goal: sprintGoal.trim() } : {}),
          },
        },
      });
      setSprintName('');
      setSprintGoal('');
      setShowCreateSprint(false);
      addToast(t('sprint.created'), 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error'), 'error');
    }
  }

  /**
   * Mueve una historia del backlog a un sprint determinado.
   * Tras la mutación, refresca ambas queries en paralelo para sincronizar
   * el estado del backlog y de los sprints sin necesidad de recargar la página.
   *
   * @param storyId - ID de la historia a mover.
   * @param sprintId - ID del sprint destino.
   */
  async function handleMoveToSprint(storyId: string, sprintId: string) {
    try {
      await moveToSprint({ variables: { storyId, sprintId } });
      // Refrescar backlog y sprints en paralelo para reducir el tiempo de actualización de la UI
      await Promise.all([refetchBacklog(), refetchSprints()]);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al mover historia', 'error');
    }
  }

  /**
   * Guarda la historia que está siendo arrastrada para renderizarla en el DragOverlay.
   * Se ejecuta al inicio del drag; la historia se busca en el backlog por ID.
   */
  function handleDragStart(event: DragStartEvent) {
    const story = backlog.find((s) => s.id === event.active.id);
    if (story) setActiveStory(story);
  }

  /**
   * Gestiona el fin del drag: limpia la historia activa y ejecuta el movimiento
   * si se soltó sobre una zona de drop válida (un sprint).
   * `over.id` contiene el ID del sprint porque `SprintDropZone` usa el sprintId como id de droppable.
   */
  async function handleDragEnd(event: DragEndEvent) {
    setActiveStory(null);
    const { active, over } = event;
    // Si no se soltó sobre ninguna zona válida, no hacer nada
    if (!over) return;
    // over.id es el id del sprint (zona de drop)
    await handleMoveToSprint(active.id as string, over.id as string);
  }

  /**
   * Calcula el color de la barra de capacidad según la relación puntos comprometidos / velocidad.
   * - Verde  (≤ 80%): capacidad holgada.
   * - Ámbar  (≤ 100%): capacidad al límite.
   * - Rojo   (> 100%): capacidad superada, riesgo de sobrecarga del equipo.
   *
   * @param committed - Puntos comprometidos en el sprint.
   * @param velocity - Velocidad promedio del equipo (puntos por sprint).
   * @returns Color hexadecimal para la barra y la etiqueta de capacidad.
   */
  function capacityColor(committed: number, velocity: number): string {
    if (velocity === 0) return '#6B7280';
    const ratio = committed / velocity;
    if (ratio <= 0.8) return '#10B981';
    if (ratio <= 1.0) return '#F59E0B';
    return '#EF4444';
  }

  /**
   * Mapea el estado de un sprint al tipo de variante del componente Badge.
   * Se usa el enum de estados de las historias como variante visual del badge
   * porque el componente Badge no define variantes propias para estados de sprint.
   *
   * @param sprint - Sprint cuyo estado se quiere representar visualmente.
   * @returns Clave de variante compatible con el componente Badge.
   */
  function statusLabel(sprint: Sprint) {
    if (sprint.status === 'ACTIVE') return 'IN_PROGRESS';
    if (sprint.status === 'COMPLETED') return 'DONE';
    return 'TODO';
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('sprint.planning')}</h1>
        <Button onClick={() => setShowCreateSprint(true)}>+ {t('sprint.new')}</Button>
      </header>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className={styles.layout}>
          {/* Backlog column */}
          <section className={styles.backlog}>
            <h2 className={styles.sectionTitle}>
              {t('backlog.title')} ({backlog.length})
              {planningSprints.length > 0 && (
                <span className={styles.dragHint}>{t('sprint.dragHint')}</span>
              )}
            </h2>
            {backlog.length === 0 ? (
              <p className={styles.empty}>{t('sprint.backlogEmpty')}</p>
            ) : (
              <div className={styles.storyList}>
                {backlog.map((story) => (
                  <PlanningStoryCard key={story.id} story={story} />
                ))}
              </div>
            )}
          </section>

          {/* Sprints column */}
          <section className={styles.sprints}>
            <div className={styles.sprintsSectionHeader}>
              <h2 className={styles.sectionTitle}>Sprints</h2>
              <div className={styles.velocityBadge} title={t('sprint.velocity')}>
                {averageVelocity > 0 ? (
                  <>
                    <span className={styles.velocityLabel}>{t('sprint.velocity')}</span>
                    <span className={styles.velocityValue}>{averageVelocity} pts</span>
                  </>
                ) : (
                  <span className={styles.velocityEmpty}>{t('sprint.noVelocity')}</span>
                )}
              </div>
            </div>
            {sprints.length === 0 ? (
              <p className={styles.empty}>{t('sprint.noSprints')}</p>
            ) : sprints.map((sprint) => (
                <SprintDropZone
                  key={sprint.id}
                  sprintId={sprint.id}
                  disabled={sprint.status !== 'PLANNING'}
                >
                  <div className={styles.sprintCard}>
                    <div className={styles.sprintHeader}>
                      <span className={styles.sprintName}>{sprint.name}</span>
                      <Badge variant={statusLabel(sprint)}>
                        {t(`status.${sprint.status === 'ACTIVE' ? 'ACTIVE' : sprint.status === 'COMPLETED' ? 'COMPLETED' : 'PLANNING'}`)}
                      </Badge>
                    </div>

                    {sprint.goal && (
                      <p className={styles.sprintGoal}>{sprint.goal}</p>
                    )}

                    <div className={styles.sprintStats}>
                      <span>{sprint.stats.totalStories} {t('sprint.stories')}</span>
                      <span>{sprint.stats.totalPoints} pts</span>
                      {sprint.status !== 'PLANNING' && (
                        <span>{sprint.stats.progressPercent}{t('sprint.pctCompleted')}</span>
                      )}
                    </div>

                    {sprint.status === 'PLANNING' && averageVelocity > 0 && (
                      <div className={styles.capacityBar}>
                        <div
                          className={styles.capacityFill}
                          style={{
                            width: `${Math.min((sprint.stats.totalPoints / averageVelocity) * 100, 100)}%`,
                            backgroundColor: capacityColor(sprint.stats.totalPoints, averageVelocity),
                          }}
                        />
                        <span
                          className={styles.capacityLabel}
                          style={{ color: capacityColor(sprint.stats.totalPoints, averageVelocity) }}
                        >
                          {sprint.stats.totalPoints}/{averageVelocity} {t('sprint.capacity')}
                        </span>
                      </div>
                    )}

                    {sprint.status === 'PLANNING' && (
                      <div className={styles.sprintActions}>
                        <Button size="sm" onClick={() => setSprintToStart(sprint)}>
                          {t('sprint.start')}
                        </Button>
                      </div>
                    )}
                    {sprint.status === 'ACTIVE' && (
                      <div className={styles.sprintActions}>
                        <Button size="sm" variant="danger" onClick={() => setSprintToClose(sprint)}>
                          {t('sprint.close')}
                        </Button>
                      </div>
                    )}
                  </div>
                </SprintDropZone>
            ))}
          </section>
        </div>

        <DragOverlay>
          {activeStory && <PlanningStoryCard story={activeStory} isOverlay />}
        </DragOverlay>
      </DndContext>

      {/* Create sprint modal */}
      <Modal
        isOpen={showCreateSprint}
        onClose={() => { setShowCreateSprint(false); setSprintName(''); setSprintGoal(''); }}
        title={t('sprint.new')}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowCreateSprint(false); setSprintName(''); setSprintGoal(''); }}>{t('common.cancel')}</Button>
            <Button onClick={handleCreateSprint} loading={creating}>{t('common.create')}</Button>
          </>
        }
      >
        <FormField label={t('sprint.name')} htmlFor="sprint-name" required>
          <Input
            id="sprint-name"
            value={sprintName}
            onChange={(e) => setSprintName(e.target.value)}
            placeholder="Sprint 1"
            autoFocus
          />
        </FormField>
        <FormField label={t('sprint.goal')} htmlFor="sprint-goal">
          <Input
            id="sprint-goal"
            value={sprintGoal}
            onChange={(e) => setSprintGoal(e.target.value)}
            placeholder={t('sprint.goalPlaceholder')}
          />
        </FormField>
      </Modal>

      {/* Start sprint modal */}
      <StartSprintModal
        sprint={sprintToStart}
        projectId={projectId ?? ''}
        onClose={() => setSprintToStart(null)}
      />

      {/* Close sprint modal */}
      <CloseSprintModal
        sprint={sprintToClose}
        projectId={projectId ?? ''}
        planningSprints={planningSprints}
        onClose={() => setSprintToClose(null)}
      />

      {/* Planning Poker — inyectado por la extensión 'planning-poker' */}
      {projectId && frontendExtensionRegistry.getSlot('planning-poker-panel') && (
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
          <ExtensionSlot
            name="planning-poker-panel"
            slotProps={{ projectId, stories: backlog }}
          />
        </div>
      )}
    </div>
  );
}
