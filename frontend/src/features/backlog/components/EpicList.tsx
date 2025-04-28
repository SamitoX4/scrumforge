import { useState, useEffect } from 'react';
import { useMutation } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
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
import { Badge } from '@/components/atoms/Badge/Badge';
import { Modal } from '@/components/organisms/Modal/Modal';
import { FormField } from '@/components/molecules/FormField/FormField';
import { Input } from '@/components/atoms/Input/Input';
import { CREATE_EPIC, DELETE_EPIC, REORDER_EPICS } from '@/graphql/backlog/backlog.mutations';
import { GET_EPICS } from '@/graphql/backlog/backlog.queries';
import { useUIStore } from '@/store/ui.store';
import { EpicDetailPanel } from './EpicDetailPanel';
import styles from './EpicList.module.scss';

/**
 * Paleta de colores predefinidos para épicas.
 * Se ofrecen swatches de selección rápida más un input color nativo para personalizar.
 * Los colores siguen la escala Tailwind para coherencia visual con el resto de la UI.
 */
const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#64748b',
];

/** Valores válidos de prioridad para épicas, en orden descendente de urgencia. */
const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

/**
 * Estadísticas calculadas para una épica a partir de sus historias de usuario.
 * Se computan en tiempo de render a partir de `allStories` para evitar una
 * query extra al servidor.
 */
interface EpicStats {
  totalPoints: number;
  completedPoints: number;
  storyCount: number;
}

/**
 * Props del componente EpicList.
 */
interface EpicListProps {
  epics: Epic[];
  projectId: string;
  /** Lista de todas las historias del proyecto, necesaria para calcular estadísticas por épica */
  allStories?: UserStory[];
}

/**
 * Props para la fila sortable de una épica individual.
 */
interface SortableEpicRowProps {
  epic: Epic;
  stats?: EpicStats;
  onOpen: (epic: Epic) => void;
  onDelete: (epic: Epic) => void;
}

/**
 * @component SortableEpicRow
 * @description Fila de épica con soporte para drag-and-drop de reordenación.
 * Muestra el color identificador, título, progreso en story points y prioridad.
 * El handle de arrastre está separado del área de clic para no interferir con
 * la apertura del panel de detalle.
 *
 * @param props.epic - Épica a representar
 * @param props.stats - Estadísticas calculadas (puntos completados / totales)
 * @param props.onOpen - Callback al hacer clic en la fila (abre EpicDetailPanel)
 * @param props.onDelete - Callback al hacer clic en el botón de eliminar
 */
function SortableEpicRow({ epic, stats, onOpen, onDelete }: SortableEpicRowProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: epic.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={styles.epicRow}
      onClick={() => onOpen(epic)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(epic)}
      aria-label={t('epic.openEpic', { title: epic.title })}
    >
      <span
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        title={t('epic.dragToReorder')}
      >⠿</span>
      <span className={styles.epicColor} style={{ backgroundColor: epic.color }} />
      <span className={styles.epicTitle}>{epic.title}</span>
      {/* Solo mostramos progreso si hay puntos estimados; evita "0/0 pts" confuso */}
      {stats && stats.totalPoints > 0 && (
        <span className={styles.epicPoints} title="SP completados / SP totales">
          {stats.completedPoints}/{stats.totalPoints} pts
        </span>
      )}
      <Badge variant={epic.priority}>{epic.priority}</Badge>
      <button
        className={styles.deleteEpicBtn}
        onClick={(e) => { e.stopPropagation(); onDelete(epic); }}
        aria-label={t('epic.deleteEpic', { title: epic.title })}
        title={t('epic.deleteEpicShort')}
      >✕</button>
    </div>
  );
}

/**
 * @component EpicList
 * @description Panel de gestión de épicas del backlog. Permite crear, reordenar
 * y eliminar épicas mediante drag-and-drop. Al eliminar una épica con historias
 * asociadas, ofrece la posibilidad de reasignarlas a otra épica para no perderlas.
 *
 * Las estadísticas de progreso (story points completados vs. totales) se derivan
 * de `allStories` en tiempo de render, evitando una query GraphQL adicional.
 *
 * La reordenación usa actualización optimista: se mueve el elemento en `localEpics`
 * de inmediato y se sincroniza con el servidor; si falla, se revierte al estado
 * original recibido por props.
 *
 * @param props.epics - Lista de épicas del proyecto (obtenida por el componente padre)
 * @param props.projectId - ID del proyecto activo
 * @param props.allStories - Todas las historias del proyecto para calcular el progreso
 */
export function EpicList({ epics, projectId, allStories = [] }: EpicListProps) {
  const { t } = useTranslation();

  // Calculamos las estadísticas por épica en una sola pasada sobre allStories.
  // Hacerlo aquí (y no en un useMemo) está bien porque EpicList no re-renderiza
  // con frecuencia y la operación es O(n) sobre las historias.
  const epicStats = new Map<string, EpicStats>();
  for (const story of allStories) {
    if (!story.epicId) continue;
    const prev = epicStats.get(story.epicId) ?? { totalPoints: 0, completedPoints: 0, storyCount: 0 };
    epicStats.set(story.epicId, {
      totalPoints: prev.totalPoints + (story.points ?? 0),
      completedPoints: prev.completedPoints + (story.status === 'DONE' ? (story.points ?? 0) : 0),
      storyCount: prev.storyCount + 1,
    });
  }

  // localEpics mantiene el orden actual incluyendo cambios optimistas de DnD.
  // Se re-sincroniza cuando el padre recibe datos frescos del servidor.
  const [localEpics, setLocalEpics] = useState<Epic[]>(epics);
  useEffect(() => { setLocalEpics(epics); }, [epics]);

  const [selectedEpic, setSelectedEpic] = useState<Epic | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('MEDIUM');
  const [color, setColor] = useState(PRESET_COLORS[0]);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Epic | null>(null);
  const [targetEpicId, setTargetEpicId] = useState('');

  const { addToast } = useUIStore();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [createEpic, { loading: creating }] = useMutation<any>(CREATE_EPIC, {
    refetchQueries: [{ query: GET_EPICS, variables: { projectId } }],
  });

  const [deleteEpic, { loading: deleting }] = useMutation<any>(DELETE_EPIC, {
    refetchQueries: [{ query: GET_EPICS, variables: { projectId } }],
  });

  const [reorderEpicsMutation] = useMutation<any>(REORDER_EPICS, {
    refetchQueries: [{ query: GET_EPICS, variables: { projectId } }],
  });

  /**
   * Reordena las épicas tras soltar el elemento arrastrado.
   * Aplica la nueva posición de forma optimista en `localEpics` y luego envía
   * al servidor el array completo de IDs ordenados. Si la mutación falla,
   * se revierte al orden original recibido por props.
   */
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localEpics.findIndex((e) => e.id === active.id);
    const newIndex = localEpics.findIndex((e) => e.id === over.id);
    const reordered = arrayMove(localEpics, oldIndex, newIndex);
    // Actualización optimista
    setLocalEpics(reordered);
    try {
      await reorderEpicsMutation({ variables: { projectId, orderedIds: reordered.map((e) => e.id) } });
    } catch (err) {
      // Rollback al orden confirmado por el servidor
      setLocalEpics(epics);
      addToast(err instanceof Error ? err.message : t('epic.reorderError'), 'error');
    }
  }

  /** Limpia todos los campos del formulario de creación al cerrar o reusar el modal. */
  function resetForm() {
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setColor(PRESET_COLORS[0]);
  }

  /**
   * Envía la mutación de creación de épica con los datos del formulario.
   * Resetea el formulario y cierra el modal en caso de éxito.
   */
  async function handleCreate() {
    if (!title.trim()) return;
    try {
      await createEpic({ variables: { input: { title, description, projectId, priority, color } } });
      addToast(t('epic.createSuccess'), 'success');
      resetForm();
      setShowCreateModal(false);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('epic.createError'), 'error');
    }
  }

  /**
   * Abre el modal de confirmación de eliminación para la épica indicada.
   * Resetea el campo de reasignación para que siempre arranque en "Sin épica".
   */
  function openDeleteModal(epic: Epic) {
    setDeleteTarget(epic);
    setTargetEpicId('');
  }

  /**
   * Ejecuta la eliminación de la épica objetivo.
   * Si el usuario seleccionó una épica de destino, las historias se reasignan
   * a ella antes de borrar; si dejó "Sin épica", quedan huérfanas (epicId = null).
   */
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteEpic({
        variables: {
          id: deleteTarget.id,
          targetEpicId: targetEpicId || undefined,
        },
      });
      addToast(t('epic.deleteSuccess'), 'success');
      setDeleteTarget(null);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('epic.deleteError'), 'error');
    }
  }

  // Estadísticas de la épica que se va a eliminar — usadas para mostrar el aviso
  // de reasignación solo si tiene historias asociadas
  const deleteStats = deleteTarget ? epicStats.get(deleteTarget.id) : null;
  // Épicas disponibles como destino de reasignación (excluye la que se va a borrar)
  const otherEpics = epics.filter((e) => e.id !== deleteTarget?.id);

  return (
    <section>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{t('epic.title')}</h2>
        <Button size="sm" onClick={() => setShowCreateModal(true)}>
          {t('epic.new')}
        </Button>
      </div>

      {localEpics.length === 0 ? (
        <p className={styles.empty}>{t('epic.empty')}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={localEpics.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            <div className={styles.list}>
              {localEpics.map((epic) => (
                <SortableEpicRow
                  key={epic.id}
                  epic={epic}
                  stats={epicStats.get(epic.id)}
                  onOpen={setSelectedEpic}
                  onDelete={openDeleteModal}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Create modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { resetForm(); setShowCreateModal(false); }}
        title={t('epic.newTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => { resetForm(); setShowCreateModal(false); }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreate} loading={creating}>
              {t('epic.createBtn')}
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <FormField label={t('story.title')} htmlFor="epic-title" required>
            <Input
              id="epic-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('epic.titlePlaceholder')}
              autoFocus
            />
          </FormField>

          <FormField label={t('story.description')} htmlFor="epic-desc">
            <Input
              id="epic-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('epic.descriptionPlaceholder')}
            />
          </FormField>

          <FormField label={t('story.priority')} htmlFor="epic-priority">
            <select
              id="epic-priority"
              className={styles.select}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{t(`priority.${p}`)}</option>
              ))}
            </select>
          </FormField>

          <FormField label={t('epic.color')} htmlFor="epic-color">
            <div className={styles.colorPicker}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={styles.colorSwatch}
                  style={{ backgroundColor: c }}
                  data-selected={color === c || undefined}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                />
              ))}
              <input
                id="epic-color"
                type="color"
                className={styles.colorCustom}
                value={color}
                onChange={(e) => setColor(e.target.value)}
                title={t('epic.customColor')}
              />
            </div>
            <div className={styles.colorPreview}>
              <span style={{ backgroundColor: color }} className={styles.colorPreviewDot} />
              <code className={styles.colorPreviewCode}>{color}</code>
            </div>
          </FormField>
        </div>
      </Modal>

      {/* Epic detail panel */}
      <EpicDetailPanel
        epic={selectedEpic}
        projectId={projectId}
        onClose={() => setSelectedEpic(null)}
      />

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('epic.deleteTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              {t('common.delete')}
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <div className={styles.deleteForm}>
            <p>
              {t('epic.deleteConfirm', { title: deleteTarget.title })}
              {deleteStats && deleteStats.storyCount > 0 ? (
                <> {t('epic.deleteHasStories', { count: deleteStats.storyCount })}</>
              ) : null}
            </p>

            {deleteStats && deleteStats.storyCount > 0 && (
              <FormField
                label={t('epic.reassignTo')}
                htmlFor="reassign-epic"
              >
                <select
                  id="reassign-epic"
                  className={styles.select}
                  value={targetEpicId}
                  onChange={(e) => setTargetEpicId(e.target.value)}
                >
                  <option value="">{t('epic.noEpic')}</option>
                  {otherEpics.map((e) => (
                    <option key={e.id} value={e.id}>{e.title}</option>
                  ))}
                </select>
              </FormField>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
