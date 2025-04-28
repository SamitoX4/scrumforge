import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { GET_EPICS, GET_BACKLOG } from '@/graphql/backlog/backlog.queries';
import { REORDER_BACKLOG, CREATE_USER_STORY } from '@/graphql/backlog/backlog.mutations';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { StatusBadge, PriorityBadge } from '@/components/atoms/Badge/Badge';
import { Avatar } from '@/components/atoms/Avatar/Avatar';
import { Button } from '@/components/atoms/Button/Button';
import { Modal } from '@/components/organisms/Modal/Modal';
import { FormField } from '@/components/molecules/FormField/FormField';
import { Input } from '@/components/atoms/Input/Input';
import { EpicList } from './EpicList';
import { UserStoryList } from './UserStoryList';
import { BacklogFilters } from './BacklogFilters';
import { BacklogToolbar } from './BacklogToolbar';
import { UserStoryDetailPanel } from './UserStoryDetailPanel';
import { BacklogByAssignee } from './BacklogByAssignee';
import { BacklogFlatList } from './BacklogFlatList';
import { BacklogCalendarView } from './BacklogCalendarView';
import { ImportStoriesModal } from './ImportStoriesModal';
import { useUIStore } from '@/store/ui.store';
import { useTranslation } from 'react-i18next';
import type { Epic, UserStory } from '@/types/api.types';
import styles from './BacklogView.module.scss';

/**
 * Modos de visualización disponibles para el backlog.
 * - epic: agrupa las historias por épica (vista principal con DnD cross-épica)
 * - assignee: agrupa por responsable asignado
 * - flat: lista plana sin agrupación
 * - unassigned_sprint: muestra solo historias sin sprint asignado
 * - calendar: vista de calendario basada en fechas de sprint
 */
type BacklogView = 'epic' | 'assignee' | 'flat' | 'unassigned_sprint' | 'calendar';

// ── Sortable row for grouped DnD ─────────────────────────────────────────────

/**
 * Props para la fila sortable dentro del contexto de DnD agrupado por épica.
 */
interface SortableRowProps {
  story: UserStory;
  isSelected: boolean;
  onToggleSelect?: (id: string) => void;
  onRowClick: (id: string) => void;
}

/**
 * @component SortableRow
 * @description Fila de historia de usuario con soporte para drag-and-drop dentro
 * del contexto agrupado por épica. Incluye handle de arrastre, checkbox de selección,
 * indicador de color de épica y metadatos de la historia.
 *
 * Se usa dentro de `EpicGroup` que define su propio `SortableContext`, lo que
 * permite reordenar dentro de la misma épica y mover entre épicas distintas.
 *
 * @param props.story - Historia de usuario a renderizar
 * @param props.isSelected - Indica si la fila está seleccionada (para acciones en lote)
 * @param props.onToggleSelect - Callback para alternar la selección; si no se pasa, oculta el checkbox
 * @param props.onRowClick - Callback al hacer clic en la fila (abre el panel de detalle)
 */
function SortableRow({ story, isSelected, onToggleSelect, onRowClick }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: story.id,
    // Pasamos el epicId como dato asociado al elemento arrastrado para que el
    // handler de dragEnd pueda detectar cambios de épica sin buscar en el DOM
    data: { epicId: story.epicId ?? null },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={styles.storyRow}
      data-selected={isSelected || undefined}
      onClick={() => onRowClick(story.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onRowClick(story.id)}
    >
      {/* El handle de arrastre detiene la propagación del click para no abrir el panel al arrastrar */}
      <span
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        aria-label="Arrastrar"
      >⠿</span>
      {onToggleSelect && (
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={isSelected}
          onChange={() => onToggleSelect(story.id)}
          // Evitamos que el click en el checkbox propague al contenedor y abra el panel
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {story.epic && (
        <span className={styles.epicDot} style={{ backgroundColor: story.epic.color }} title={story.epic.title} />
      )}
      <span className={styles.storyTitle}>{story.title}</span>
      <div className={styles.storyMeta}>
        <StatusBadge status={story.status} />
        <PriorityBadge priority={story.priority} />
        {story.points != null && <span className={styles.points}>{story.points} pts</span>}
        {story.assignee && <Avatar name={story.assignee.name} avatarUrl={story.assignee.avatarUrl} size="xs" />}
      </div>
    </div>
  );
}

// ── Epic group with its own SortableContext ───────────────────────────────────

/**
 * Props para el contenedor agrupador de historias por épica.
 */
interface EpicGroupProps {
  epic: Epic | null; // null = "sin épica"
  stories: UserStory[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onRowClick: (id: string) => void;
}

/**
 * Prefijo usado para construir los IDs de los contenedores droppable vacíos.
 * Al recibir un `over.id` con este prefijo en `handleDragEnd`, sabemos que
 * la historia se soltó sobre un grupo vacío (cambio de épica sin reordenación).
 */
const EPIC_CONTAINER_PREFIX = 'epic-container-';

/**
 * @component EpicGroup
 * @description Contenedor visual y lógico para las historias de una épica dentro
 * del backlog. Combina un `SortableContext` (para reordenar historias dentro del
 * grupo) con un `useDroppable` en el contenedor vacío (para recibir historias de
 * otras épicas cuando el grupo no tiene elementos).
 *
 * La distinción entre drop en historia existente vs. drop en contenedor vacío
 * permite implementar el movimiento cross-épica sin necesidad de un endpoint
 * separado: ambos casos se resuelven en `handleDragEnd` de `BacklogView`.
 *
 * @param props.epic - Épica del grupo; `null` representa el grupo "Sin épica"
 * @param props.stories - Lista de historias que pertenecen a esta épica
 * @param props.selectedIds - Set de IDs de historias seleccionadas (para selección múltiple)
 * @param props.onToggleSelect - Callback para alternar selección individual
 * @param props.onRowClick - Callback al hacer clic en una fila (abre panel de detalle)
 */
function EpicGroup({ epic, stories, selectedIds, onToggleSelect, onRowClick }: EpicGroupProps) {
  const { t } = useTranslation();
  // El containerId único permite identificar el drop en grupos vacíos en handleDragEnd
  const containerId = `${EPIC_CONTAINER_PREFIX}${epic?.id ?? 'no-epic'}`;
  const { setNodeRef, isOver } = useDroppable({ id: containerId });

  return (
    <div className={styles.epicGroup}>
      <div className={styles.epicGroupHeader}>
        {epic ? (
          <>
            <span className={styles.epicGroupDot} style={{ backgroundColor: epic.color }} />
            <span className={styles.epicGroupTitle}>{epic.title}</span>
          </>
        ) : (
          <span className={styles.epicGroupTitle}>{t('backlog.noEpic')}</span>
        )}
        <span className={styles.epicGroupCount}>{stories.length}</span>
      </div>
      <SortableContext items={stories.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        {/* minHeight garantiza que el droppable tenga área suficiente cuando está vacío */}
        <div
          ref={setNodeRef}
          className={styles.groupList}
          style={{ minHeight: stories.length === 0 ? '60px' : undefined }}
        >
          {stories.map((story) => (
            <SortableRow
              key={story.id}
              story={story}
              isSelected={selectedIds.has(story.id)}
              onToggleSelect={onToggleSelect}
              onRowClick={onRowClick}
            />
          ))}
          {/* Indicador visual de zona de drop solo cuando el grupo está vacío */}
          {stories.length === 0 && (
            <div
              className={styles.groupEmpty}
              style={{ background: isOver ? 'var(--color-primary-light, #eef2ff)' : undefined }}
            >
              {t('backlog.dragHere')}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ── BacklogView ───────────────────────────────────────────────────────────────

/**
 * @component BacklogView
 * @description Vista principal del backlog del proyecto. Permite visualizar,
 * filtrar, reordenar y gestionar historias de usuario mediante drag-and-drop.
 *
 * Características principales:
 * - Cinco modos de vista (épica, responsable, lista plana, sin sprint, calendario)
 * - DnD cross-épica con actualización optimista y rollback en caso de error
 * - Filtros persistentes en el store global con opción de guardar filtros
 * - Creación rápida de historias con asignación de épica y puntos
 * - Importación masiva por CSV
 * - Panel lateral de detalle sin abandonar la vista
 *
 * La vista agrupada (modo 'epic' sin filtro de épica activo) construye un
 * `DndContext` que engloba todos los `EpicGroup`, permitiendo mover historias
 * entre épicas en una sola operación de drag-and-drop.
 */
export default function BacklogView() {
  const { projectId, project } = useCurrentProject();
  const { backlogFilters: filters, setBacklogFilters: setFilters, savedFilters, saveFilter, deleteSavedFilter } = useUIStore();
  const { addToast } = useUIStore();
  const { t } = useTranslation();

  const VIEW_OPTIONS: { key: BacklogView; label: string; icon: string }[] = [
    { key: 'epic', label: t('backlog.epicView'), icon: '📋' },
    { key: 'assignee', label: t('backlog.assignedView'), icon: '👤' },
    { key: 'flat', label: t('backlog.listView'), icon: '≡' },
    { key: 'unassigned_sprint', label: t('backlog.noSprintView'), icon: '📌' },
    { key: 'calendar', label: t('backlog.calendarView'), icon: '📅' },
  ];

  // IDs de las historias seleccionadas para acciones masivas (mover a sprint, etc.)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // ID de la historia cuyo panel de detalle está abierto (null = cerrado)
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  // Historia que se está arrastrando actualmente — se usa para el DragOverlay visual
  const [activeStory, setActiveStory] = useState<UserStory | null>(null);
  // Copia local de las historias para aplicar reordenamientos optimistas
  const [localStories, setLocalStories] = useState<UserStory[]>([]);
  const [activeView, setActiveView] = useState<BacklogView>('epic');

  // ── Import CSV modal ──────────────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);

  // ── Create story modal ────────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createEpicId, setCreateEpicId] = useState('');
  const [createPoints, setCreatePoints] = useState('');

  // activationConstraint: distance 5px evita activar el drag en clicks accidentales
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  /**
   * Alterna la selección de una historia en el set de IDs seleccionados.
   * Se memoriza con useCallback porque se pasa como prop a múltiples SortableRow,
   * evitando re-renders innecesarios de filas no afectadas.
   */
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const deselectAll = useCallback(() => setSelectedIds(new Set()), []);

  const { data: epicsData, loading: epicsLoading } = useQuery<any>(GET_EPICS, {
    variables: { projectId },
    skip: !projectId,
  });

  const { data: backlogData, loading: backlogLoading, refetch } = useQuery<any>(GET_BACKLOG, {
    variables: { projectId },
    skip: !projectId,
  });

  const [reorderBacklog] = useMutation<any>(REORDER_BACKLOG, {
    refetchQueries: [{ query: GET_BACKLOG, variables: { projectId } }],
  });

  const [createUserStory, { loading: creating }] = useMutation<any>(CREATE_USER_STORY, {
    refetchQueries: [{ query: GET_BACKLOG, variables: { projectId } }],
  });

  /**
   * Abre el modal de creación de historia, preseleccionando la épica activa
   * del filtro si existe. Así el usuario no tiene que volver a elegirla cuando
   * está trabajando dentro de una épica específica.
   */
  function openCreateModal() {
    setCreateTitle('');
    setCreateEpicId(filters.epicId ?? '');
    setCreatePoints('');
    setShowCreateModal(true);
  }

  /**
   * Envía la mutación para crear la historia y cierra el modal en caso de éxito.
   * Los puntos se parsean como entero; si el campo está vacío, se omiten del input
   * para que el servidor los deje como null.
   */
  async function handleCreate() {
    if (!createTitle.trim()) return;
    try {
      await createUserStory({
        variables: {
          input: {
            title: createTitle.trim(),
            projectId,
            epicId: createEpicId || undefined,
            points: createPoints ? parseInt(createPoints, 10) : undefined,
          },
        },
      });
      addToast(t('common.success'), 'success');
      setShowCreateModal(false);
    } catch (err) {
      addToast(err instanceof Error ? err.message : t('common.error'), 'error');
    }
  }

  // Sincroniza localStories cuando llegan datos del servidor.
  // Se hace en useEffect en lugar del callback onCompleted (deprecado en Apollo v4)
  // para mantener la copia local siempre actualizada tras refetches.
  useEffect(() => {
    if (backlogData?.backlog) setLocalStories(backlogData.backlog);
  }, [backlogData]);

  const epics: Epic[] = epicsData?.epics ?? [];
  const allStories: UserStory[] = backlogData?.backlog ?? [];

  // Se filtra sobre localStories (copia optimista) y no sobre backlogData para
  // que los cambios de reordenación sean inmediatamente visibles sin esperar al servidor.
  const filteredStories = useMemo(() => localStories.filter((story) => {
    if (filters.epicId && story.epicId !== filters.epicId) return false;
    if (filters.status && story.status !== filters.status) return false;
    if (filters.priority && story.priority !== filters.priority) return false;
    return true;
  }), [localStories, filters]);

  // Agrupa las historias filtradas por épica. Se inicializa con todas las épicas
  // (incluyendo las vacías) para que cada EpicGroup siempre aparezca aunque no
  // tenga historias, lo que permite hacer drop en grupos vacíos.
  // IMPORTANTE: este hook debe declararse antes de cualquier return condicional.
  const groupedStories = useMemo(() => {
    const map = new Map<string | null, UserStory[]>();
    // Pre-populamos el mapa con todas las épicas para preservar el orden y mostrar grupos vacíos
    for (const epic of epics) map.set(epic.id, []);
    map.set(null, []); // bucket para historias sin épica
    for (const story of filteredStories) {
      const key = story.epicId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(story);
    }
    return map;
  }, [filteredStories, epics]);

  if (epicsLoading || backlogLoading) {
    return <div className={styles.loading}><Spinner size="lg" /></div>;
  }

  /**
   * Captura la historia que comienza a arrastrarse para mostrar el DragOverlay.
   * El overlay es un clon visual ligero que sigue al cursor mientras dura el drag.
   */
  function handleDragStart(event: DragStartEvent) {
    const story = localStories.find((s) => s.id === event.active.id);
    setActiveStory(story ?? null);
  }

  /**
   * Maneja el final del drag-and-drop de historias en la vista agrupada por épica.
   *
   * Hay dos escenarios posibles:
   * 1. Drop sobre un contenedor de épica vacío (over.id empieza por EPIC_CONTAINER_PREFIX):
   *    Solo cambia la épica de la historia, mantiene su posición en el array global.
   * 2. Drop sobre otra historia (over.id es el ID de una historia):
   *    Puede implicar reordenación dentro de la misma épica, o mover a otra épica.
   *
   * En ambos casos se aplica un update optimista en localStories antes de
   * llamar al servidor, y se revierte a allStories si la mutación falla.
   */
  async function handleDragEnd(event: DragEndEvent) {
    setActiveStory(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedStory = localStories.find((s) => s.id === active.id);
    if (!draggedStory) return;

    const overId = over.id as string;

    // Caso 1: drop sobre un grupo vacío — solo actualiza la épica, mantiene posición
    if (overId.startsWith(EPIC_CONTAINER_PREFIX)) {
      const epicPart = overId.slice(EPIC_CONTAINER_PREFIX.length);
      const targetEpicId = epicPart === 'no-epic' ? null : epicPart;
      // Si la épica destino es la misma que la actual, no hay nada que hacer
      if ((draggedStory.epicId ?? null) === targetEpicId) return;
      const currentIndex = localStories.findIndex((s) => s.id === draggedStory.id);
      // Actualización optimista: solo cambia epicId
      setLocalStories((prev) =>
        prev.map((s) => s.id === draggedStory.id ? { ...s, epicId: targetEpicId } : s),
      );
      try {
        await reorderBacklog({
          variables: { projectId, storyId: active.id as string, newPosition: currentIndex, targetEpicId },
        });
      } catch (err) {
        // Rollback al estado confirmado por el servidor
        setLocalStories(allStories);
        addToast(err instanceof Error ? err.message : t('common.error'), 'error');
      }
      return;
    }

    // Caso 2: drop sobre otra historia — puede cambiar épica y/o posición
    const overStory = localStories.find((s) => s.id === overId);
    if (!overStory) return;

    const sourceEpicId = draggedStory.epicId ?? null;
    const targetEpicId = overStory.epicId ?? null;
    const epicChanged = sourceEpicId !== targetEpicId;

    const newIndex = localStories.findIndex((s) => s.id === overId);

    // Actualización optimista: cambia la épica si es necesario y reordena
    setLocalStories((prev) => {
      const updated = prev.map((s) =>
        s.id === draggedStory.id ? { ...s, epicId: targetEpicId } : s,
      );
      const oldIdx = updated.findIndex((s) => s.id === draggedStory.id);
      return arrayMove(updated, oldIdx, newIndex);
    });

    try {
      await reorderBacklog({
        variables: {
          projectId,
          storyId: active.id as string,
          newPosition: newIndex,
          // Solo enviamos targetEpicId si la épica realmente cambió
          ...(epicChanged ? { targetEpicId } : {}),
        },
      });
    } catch (err) {
      // Rollback al estado confirmado por el servidor
      setLocalStories(allStories);
      addToast(err instanceof Error ? err.message : t('common.error'), 'error');
    }
  }

  // Si hay un filtro de épica activo, la vista agrupada cross-épica no tiene sentido;
  // se delega en UserStoryList (lista plana dentro de esa única épica con su propio DnD).
  const showGrouped = !filters.epicId;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('backlog.title')}</h1>
        {project && <span className={styles.projectKey}>{project.key}</span>}
        <div style={{ display: 'flex', gap: '2px', marginLeft: 'auto', background: 'var(--color-surface-raised)', borderRadius: '6px', padding: '2px', border: '1px solid var(--color-border)' }}>
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setActiveView(opt.key)}
              title={opt.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.3rem 0.65rem',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: activeView === opt.key ? 600 : 400,
                background: activeView === opt.key ? 'var(--color-primary, #6366f1)' : 'transparent',
                color: activeView === opt.key ? '#fff' : 'var(--color-text-secondary)',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </header>

      <div className={styles.content}>
        <EpicList epics={epics} projectId={projectId!} allStories={allStories} />

        <BacklogFilters
          epics={epics}
          filters={filters}
          onChange={setFilters}
          totalCount={allStories.length}
          filteredCount={filteredStories.length}
        />

        {/* ── Saved filters ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', padding: '0.4rem 0', marginBottom: '0.25rem' }}>
          <button
            onClick={() => {
              const name = window.prompt(t('backlog.saveFilter') + ':');
              if (name && name.trim()) saveFilter(name.trim(), filters);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.25rem 0.65rem',
              borderRadius: '20px',
              border: '1px dashed var(--color-border, #3f3f5a)',
              background: 'transparent',
              color: 'var(--color-text-secondary, #94a3b8)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            💾 {t('backlog.saveFilter')}
          </button>
          {savedFilters.map((sf) => (
            <span
              key={sf.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.25rem 0.5rem 0.25rem 0.75rem',
                borderRadius: '20px',
                background: 'var(--color-surface-raised, #2a2a40)',
                border: '1px solid var(--color-border, #3f3f5a)',
                fontSize: '0.75rem',
                color: 'var(--color-text, #e2e8f0)',
                cursor: 'pointer',
              }}
              onClick={() => setFilters(sf.filters)}
              title="Aplicar filtro"
            >
              {sf.name}
              <button
                onClick={(e) => { e.stopPropagation(); deleteSavedFilter(sf.id); }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-secondary, #94a3b8)',
                  padding: '0',
                  lineHeight: 1,
                  fontSize: '0.8rem',
                }}
                title="Eliminar filtro guardado"
              >
                ✕
              </button>
            </span>
          ))}
        </div>

        <BacklogToolbar
          projectId={projectId!}
          selectedIds={selectedIds}
          totalCount={filteredStories.length}
          onSelectAll={() => setSelectedIds(new Set(filteredStories.map((s) => s.id)))}
          onDeselectAll={deselectAll}
          onActionComplete={() => { deselectAll(); refetch(); }}
        />

        <div className={styles.storiesHeader}>
          <span className={styles.storiesCount}>
            {filteredStories.length} {t('sprint.stories')}
          </span>
          <Button size="sm" variant="secondary" onClick={() => setShowImport(true)}>{t('backlog.importCsv')}</Button>
          <Button size="sm" onClick={openCreateModal}>+ {t('story.new')}</Button>
        </div>

        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title={t('story.newTitle')}
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleCreate} loading={creating}>{t('story.createBtn')}</Button>
            </>
          }
        >
          <div className={styles.createForm}>
            <FormField label={t('story.title')} htmlFor="bv-story-title" required>
              <Input
                id="bv-story-title"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder="Como [rol] quiero [acción] para [beneficio]"
                autoFocus
              />
            </FormField>

            {epics.length > 0 && (
              <FormField label={t('backlog.epics')} htmlFor="bv-story-epic">
                {filters.epicId ? (
                  // Epic locked when filtering by epic
                  <div className={styles.lockedEpic}>
                    {(() => {
                      const epic = epics.find((e) => e.id === filters.epicId);
                      return epic ? (
                        <>
                          <span className={styles.lockedEpicDot} style={{ backgroundColor: epic.color }} />
                          <span>{epic.title}</span>
                        </>
                      ) : null;
                    })()}
                  </div>
                ) : (
                  <select
                    id="bv-story-epic"
                    className={styles.createSelect}
                    value={createEpicId}
                    onChange={(e) => setCreateEpicId(e.target.value)}
                  >
                    <option value="">{t('backlog.noEpic')}</option>
                    {epics.map((e) => (
                      <option key={e.id} value={e.id}>{e.title}</option>
                    ))}
                  </select>
                )}
              </FormField>
            )}

            <FormField label={t('story.points')} htmlFor="bv-story-points" hint="Fibonacci: 1, 2, 3, 5, 8, 13">
              <Input
                id="bv-story-points"
                type="number"
                min={1}
                max={100}
                value={createPoints}
                onChange={(e) => setCreatePoints(e.target.value)}
                placeholder="ej. 5"
              />
            </FormField>
          </div>
        </Modal>

        {activeView === 'epic' && (
          showGrouped ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {epics.map((epic) => (
                <EpicGroup
                  key={epic.id}
                  epic={epic}
                  stories={groupedStories.get(epic.id) ?? []}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onRowClick={setSelectedStoryId}
                />
              ))}
              <EpicGroup
                key="no-epic"
                epic={null}
                stories={groupedStories.get(null) ?? []}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onRowClick={setSelectedStoryId}
              />
              <DragOverlay>
                {activeStory && (
                  <div className={styles.dragOverlay}>
                    {activeStory.title}
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          ) : (
            // Filtered by epic: use existing UserStoryList (single-epic DnD)
            <UserStoryList
              stories={filteredStories}
              epics={epics}
              projectId={projectId!}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              hideCreateButton
            />
          )
        )}

        {activeView === 'assignee' && (
          <BacklogByAssignee
            stories={filteredStories}
            projectId={projectId!}
            onSelectStory={setSelectedStoryId}
          />
        )}

        {activeView === 'flat' && (
          <BacklogFlatList
            stories={filteredStories}
            onSelectStory={setSelectedStoryId}
          />
        )}

        {activeView === 'unassigned_sprint' && (
          <BacklogFlatList
            stories={filteredStories.filter((s) => !s.sprintId)}
            onSelectStory={setSelectedStoryId}
          />
        )}

        {activeView === 'calendar' && (
          <BacklogCalendarView stories={allStories} sprints={[]} />
        )}
      </div>

      <UserStoryDetailPanel
        storyId={selectedStoryId}
        projectId={projectId!}
        epics={epics}
        onClose={() => setSelectedStoryId(null)}
      />

      {showImport && (
        <ImportStoriesModal
          projectId={projectId!}
          onClose={() => setShowImport(false)}
          onImported={() => refetch()}
        />
      )}
    </div>
  );
}
