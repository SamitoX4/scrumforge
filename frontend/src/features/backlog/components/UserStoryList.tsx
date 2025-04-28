import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Epic, UserStory } from '@/types/api.types';
import { Button } from '@/components/atoms/Button/Button';
import { StatusBadge, PriorityBadge } from '@/components/atoms/Badge/Badge';
import { Avatar } from '@/components/atoms/Avatar/Avatar';
import { Modal } from '@/components/organisms/Modal/Modal';
import { FormField } from '@/components/molecules/FormField/FormField';
import { Input } from '@/components/atoms/Input/Input';
import { UserStoryDetailPanel } from './UserStoryDetailPanel';
import { CREATE_USER_STORY, REORDER_BACKLOG } from '@/graphql/backlog/backlog.mutations';
import { GET_BACKLOG } from '@/graphql/backlog/backlog.queries';
import { useUIStore } from '@/store/ui.store';
import styles from './UserStoryList.module.scss';

/**
 * Props del componente UserStoryList.
 */
interface UserStoryListProps {
  stories: UserStory[];
  epics: Epic[];
  projectId: string;
  /** IDs de historias seleccionadas para acciones en lote (gestionado externamente) */
  selectedIds?: Set<string>;
  /** Si se omite, no se renderiza el checkbox de selección en cada fila */
  onToggleSelect?: (id: string) => void;
  /** Oculta el botón "+ Nueva historia" cuando la acción de crear se gestiona desde el padre */
  hideCreateButton?: boolean;
}

/**
 * Props para la fila sortable de historia individual.
 */
interface SortableStoryRowProps {
  story: UserStory;
  isSelected: boolean;
  onToggleSelect?: (id: string) => void;
  onRowClick: (id: string) => void;
}

/**
 * @component SortableStoryRow
 * @description Fila de historia de usuario con soporte para drag-and-drop dentro
 * de la lista plana de `UserStoryList`. A diferencia de la versión en `BacklogView`,
 * esta no incluye datos de épica en el contexto del elemento arrastrado porque
 * opera dentro de una única épica (o sin agrupación).
 *
 * El handle de arrastre (`⠿`) detiene la propagación del click para evitar
 * abrir el panel de detalle al iniciar el drag.
 *
 * @param props.story - Historia de usuario a representar
 * @param props.isSelected - Estado de selección para acciones en lote
 * @param props.onToggleSelect - Callback para checkbox; si está ausente, el checkbox no se muestra
 * @param props.onRowClick - Callback al hacer clic en la fila (abre el panel de detalle)
 */
function SortableStoryRow({ story, isSelected, onToggleSelect, onRowClick }: SortableStoryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: story.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={styles.storyRow}
      data-selected={isSelected || undefined}
      onClick={() => onRowClick(story.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onRowClick(story.id)}
      aria-label={`Ver detalle: ${story.title}`}
    >
      <span
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        aria-label="Arrastrar para reordenar"
      >
        ⠿
      </span>

      {onToggleSelect && (
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={isSelected}
          onChange={() => onToggleSelect(story.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Seleccionar: ${story.title}`}
        />
      )}
      {story.epic && (
        <span
          className={styles.epicDot}
          style={{ backgroundColor: story.epic.color }}
          title={story.epic.title}
        />
      )}
      <span className={styles.storyTitle}>{story.title}</span>
      <div className={styles.storyMeta}>
        <StatusBadge status={story.status} />
        <PriorityBadge priority={story.priority} />
        {story.points != null && (
          <span className={styles.points}>{story.points} pts</span>
        )}
        {story.assignee && (
          <Avatar name={story.assignee.name} avatarUrl={story.assignee.avatarUrl} size="xs" />
        )}
      </div>
    </div>
  );
}

/**
 * @component UserStoryList
 * @description Lista de historias de usuario con drag-and-drop para reordenar,
 * creación rápida inline y creación detallada por modal. Es la vista utilizada
 * cuando hay un filtro de épica activo en el backlog (lista plana dentro de
 * una sola épica).
 *
 * Dos modos de creación de historias:
 * - Creación rápida: campo inline que aparece al pulsar "+ Añadir historia";
 *   permite crear historias sucesivas sin cerrar el campo (ideal para sesiones
 *   de refinamiento).
 * - Modal completo: permite asignar épica y puntos además del título.
 *
 * El componente mantiene `localStories` como copia del prop `stories` para
 * aplicar actualizaciones optimistas de reordenación sin depender del refetch.
 *
 * @param props.stories - Lista de historias a mostrar (ya filtradas por el padre)
 * @param props.epics - Épicas disponibles para el selector del modal
 * @param props.projectId - ID del proyecto activo
 * @param props.selectedIds - Set de IDs seleccionados (para selección en lote)
 * @param props.onToggleSelect - Callback para alternar la selección de una historia
 * @param props.hideCreateButton - Si es true, oculta el botón de crear (el padre lo gestiona)
 */
export function UserStoryList({ stories, epics, projectId, selectedIds, onToggleSelect, hideCreateButton = false }: UserStoryListProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [epicId, setEpicId] = useState('');
  const [points, setPoints] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  // localStories permite actualizaciones optimistas de reordenación
  const [localStories, setLocalStories] = useState<UserStory[]>(stories);
  const { addToast } = useUIStore();

  // Sincronización defensiva: si el padre actualiza el array (ej. tras un refetch),
  // comparamos las secuencias de IDs para detectar el cambio sin deep-equal costoso.
  // No se usa useEffect porque este patrón de render-phase setState es más seguro
  // cuando el cambio depende del prop actual y no de un efecto secundario.
  if (localStories !== stories && localStories.map((s) => s.id).join() !== stories.map((s) => s.id).join()) {
    setLocalStories(stories);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [createStory, { loading }] = useMutation<any>(CREATE_USER_STORY, {
    refetchQueries: [{ query: GET_BACKLOG, variables: { projectId } }],
  });

  const [reorderBacklog] = useMutation<any>(REORDER_BACKLOG, {
    refetchQueries: [{ query: GET_BACKLOG, variables: { projectId } }],
  });

  /**
   * Crea una historia con solo el título desde el campo inline de creación rápida.
   * El input NO se limpia después de crear — esto permite crear varias historias
   * de forma consecutiva sin interrumpir el flujo durante sesiones de refinamiento.
   */
  async function handleQuickCreate() {
    if (!quickTitle.trim()) return;
    try {
      await createStory({ variables: { input: { title: quickTitle.trim(), projectId } } });
      setQuickTitle('');
      // Mantenemos el input abierto para entrada rápida de múltiples historias
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al crear historia', 'error');
    }
  }

  /**
   * Crea una historia con título, épica y puntos desde el modal detallado.
   * Los puntos se convierten a entero; si está vacío, se omite del input para
   * que el servidor lo deje como null y no lo cuente en la velocidad del sprint.
   */
  async function handleCreate() {
    if (!title.trim()) return;
    try {
      await createStory({
        variables: {
          input: {
            title,
            projectId,
            epicId: epicId || undefined,
            points: points ? parseInt(points, 10) : undefined,
          },
        },
      });
      addToast('Historia creada correctamente', 'success');
      setTitle('');
      setEpicId('');
      setPoints('');
      setShowModal(false);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al crear historia', 'error');
    }
  }

  /**
   * Reordena las historias tras soltar el elemento arrastrado.
   * Aplica el nuevo orden optimistamente en localStories antes de esperar
   * al servidor. Si la mutación falla, se revierte al orden original del prop.
   */
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localStories.findIndex((s) => s.id === active.id);
    const newIndex = localStories.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Actualización optimista para respuesta visual inmediata
    setLocalStories((prev) => arrayMove(prev, oldIndex, newIndex));

    try {
      await reorderBacklog({
        variables: { projectId, storyId: active.id as string, newPosition: newIndex },
      });
    } catch (err) {
      // Rollback al estado confirmado por el servidor
      setLocalStories(stories);
      addToast(err instanceof Error ? err.message : 'Error al reordenar backlog', 'error');
    }
  }

  return (
    <>
      <section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            Backlog ({localStories.length} historias)
          </h2>
          {!hideCreateButton && (
            <Button size="sm" onClick={() => setShowModal(true)}>
              + Nueva historia
            </Button>
          )}
        </div>

        {localStories.length === 0 ? (
          <p className={styles.empty}>
            El backlog está vacío. Crea tu primera historia de usuario.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={localStories.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className={styles.list}>
                {localStories.map((story) => {
                  const isSelected = selectedIds?.has(story.id) ?? false;
                  return (
                    <SortableStoryRow
                      key={story.id}
                      story={story}
                      isSelected={isSelected}
                      onToggleSelect={onToggleSelect}
                      onRowClick={setSelectedStoryId}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {showQuickCreate ? (
          <div className={styles.quickCreateRow}>
            <input
              autoFocus
              className={styles.quickInput}
              placeholder="Título de la historia... (Enter para crear, Esc para cancelar)"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') { await handleQuickCreate(); }
                else if (e.key === 'Escape') { setShowQuickCreate(false); setQuickTitle(''); }
              }}
              onBlur={() => { if (!quickTitle.trim()) setShowQuickCreate(false); }}
            />
          </div>
        ) : (
          <button className={styles.addRow} onClick={() => setShowQuickCreate(true)}>
            + Añadir historia
          </button>
        )}

        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Nueva historia de usuario"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} loading={loading}>
                Crear historia
              </Button>
            </>
          }
        >
          <div className={styles.form}>
            <FormField label="Título" htmlFor="story-title" required>
              <Input
                id="story-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Como [rol] quiero [acción] para [beneficio]"
                autoFocus
              />
            </FormField>

            {epics.length > 0 && (
              <FormField label="Épica" htmlFor="story-epic">
                <select
                  id="story-epic"
                  className={styles.select}
                  value={epicId}
                  onChange={(e) => setEpicId(e.target.value)}
                >
                  <option value="">Sin épica</option>
                  {epics.map((e) => (
                    <option key={e.id} value={e.id}>{e.title}</option>
                  ))}
                </select>
              </FormField>
            )}

            <FormField label="Story points" htmlFor="story-points" hint="Fibonacci: 1, 2, 3, 5, 8, 13">
              <Input
                id="story-points"
                type="number"
                min={1}
                max={100}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder="ej. 5"
              />
            </FormField>
          </div>
        </Modal>
      </section>

      {/* Detail panel — rendered via portal */}
      <UserStoryDetailPanel
        storyId={selectedStoryId}
        projectId={projectId}
        epics={epics}
        onClose={() => setSelectedStoryId(null)}
      />
    </>
  );
}
