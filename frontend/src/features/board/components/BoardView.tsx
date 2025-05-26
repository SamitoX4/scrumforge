import { useQuery } from '@apollo/client/react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentProject } from '@/hooks/useCurrentProject';
import { useMyProjectRole } from '@/hooks/useMyProjectRole';
import { usePermissions } from '@/hooks/usePermissions';
import { useActiveSprint } from '@/hooks/useActiveSprint';
import { useBoardRealtime } from '@/hooks/useBoardRealtime';
import { useBoardDnd } from '@/hooks/useBoardDnd';
import { GET_EPICS } from '@/graphql/backlog/backlog.queries';
import { GET_BOARD_COLUMNS } from '@/graphql/board/board.queries';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { Button } from '@/components/atoms/Button/Button';
import { useUIStore } from '@/store/ui.store';
import { BoardColumn } from './BoardColumn';
import { BoardCard } from './BoardCard';
import { BoardFilters, type BoardFilterState } from './BoardFilters';
import { ManageColumnsModal } from './ManageColumnsModal';
import { BlockStoryModal } from './BlockStoryModal';
import { UnblockStoryModal } from './UnblockStoryModal';
import { UserStoryDetailPanel } from '@/features/backlog/components/UserStoryDetailPanel';
import { DodValidationModal } from '@/features/definition-of-done/DodValidationModal';
import type { UserStory, StoryStatus, Epic, User } from '@/types/api.types';
import styles from './BoardView.module.scss';

/**
 * Configuración de una columna del tablero Kanban.
 * Las columnas pueden ser predeterminadas (TODO/IN_PROGRESS/IN_REVIEW/DONE)
 * o configuradas por el usuario con título y color personalizados.
 */
interface BoardColumnConfig {
  id: string;
  title: string;
  status: string;
  color?: string;
  order: number;
  /** Límite WIP (Work In Progress); undefined/null = sin límite */
  wipLimit?: number | null;
}

/**
 * Estados predeterminados del tablero. Se usan como fallback cuando no hay
 * configuración guardada en base de datos para el proyecto.
 */
const DEFAULT_COLUMN_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;

/**
 * @component BoardView
 * @description Tablero Kanban del sprint activo. Permite mover historias entre
 * columnas mediante drag-and-drop, con validación de Definition of Done al
 * pasar a DONE.
 *
 * Características:
 * - Columnas configurables (título, color, límite WIP) por proyecto
 * - Filtros por responsable y prioridad
 * - Modo Zen: oculta filtros y stats para máxima concentración (atajo: tecla Z)
 * - Actualizaciones en tiempo real vía WebSocket (useBoardRealtime)
 * - Control de permisos: solo usuarios con canMoveTasksOnBoard pueden arrastrar
 * - Gestión de bloqueos: marcar/desmarcar historias bloqueadas con motivo
 * - Panel de detalle lateral de la historia seleccionada
 * - Modal de DoD: intercepta el movimiento a DONE para confirmar criterios
 *
 * El DnD está encapsulado en el hook `useBoardDnd`, que expone `onBeforeMoveToDone`
 * como punto de extensión para inyectar la lógica de validación de DoD mediante
 * una Promesa que se resuelve desde el modal.
 */
export default function BoardView() {
  const { projectId, project } = useCurrentProject();
  const { t } = useTranslation();

  // Columnas por defecto usadas mientras no llega la configuración del servidor
  const DEFAULT_COLUMNS: BoardColumnConfig[] = DEFAULT_COLUMN_STATUSES.map((status, order) => ({
    id: status,
    title: t(`status.${status}`),
    status,
    order,
  }));
  const myRole = useMyProjectRole(project?.teamId);
  const { can } = usePermissions(myRole);
  // El permiso canMoveTasksOnBoard separa Developers/SM (pueden arrastrar)
  // de observadores o roles de solo lectura
  const canDrag = can('canMoveTasksOnBoard');
  const { zenMode, toggleZenMode, exitZenMode } = useUIStore();
  // ID de la historia cuyo panel lateral está abierto
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  // ID de la historia en proceso de ser bloqueada (abre BlockStoryModal)
  const [blockingStoryId, setBlockingStoryId] = useState<string | null>(null);
  // ID de la historia en proceso de ser desbloqueada (abre UnblockStoryModal)
  const [unblockingStoryId, setUnblockingStoryId] = useState<string | null>(null);
  const [filters, setFilters] = useState<BoardFilterState>({ assigneeId: '', priority: '' });
  const [showManageColumns, setShowManageColumns] = useState(false);
  // Estado para la validación pendiente de DoD: la Promesa se resuelve desde DodValidationModal
  const [dodPending, setDodPending] = useState<{ story: { id: string; title: string }; resolve: (v: boolean) => void } | null>(null);

  // Atajos de teclado para el modo Zen. Se ignoran cuando el foco está en un input
  // para no interferir con la escritura del usuario.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'z' || e.key === 'Z') toggleZenMode();
      if (e.key === 'Escape' && zenMode) exitZenMode();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [zenMode, toggleZenMode, exitZenMode]);

  const { sprint, stories, loading } = useActiveSprint(projectId);

  // Suscripción WebSocket para actualizaciones en tiempo real del tablero.
  // El hook actualiza el caché de Apollo directamente (sin refetch) para
  // minimizar la latencia percibida cuando otro miembro mueve una tarjeta.
  useBoardRealtime(projectId);

  // onBeforeMoveToDone intercepta el drag antes de confirmar el movimiento a DONE.
  // Devuelve una Promesa que el modal resolverá con true (confirmar) o false (cancelar).
  const { activeStory, sensors, handleDragStart, handleDragEnd } = useBoardDnd({
    stories,
    onBeforeMoveToDone: (story) =>
      new Promise<boolean>((resolve) => setDodPending({ story, resolve })),
  });

  const { data: columnsData } = useQuery<{ boardColumns: BoardColumnConfig[] }>(GET_BOARD_COLUMNS, {
    variables: { projectId },
    skip: !projectId,
  });

  const { data: epicsData } = useQuery<any>(GET_EPICS, {
    variables: { projectId },
    skip: !projectId,
  });

  // Si el proyecto no tiene columnas configuradas, usamos las predeterminadas
  const columns = columnsData?.boardColumns ?? DEFAULT_COLUMNS;
  const epics: Epic[] = epicsData?.epics ?? [];

  // Deduplica responsables a partir de las historias del sprint activo.
  // Se usa Set para evitar duplicados cuando un usuario tiene varias historias.
  const assignees = useMemo<User[]>(() => {
    const seen = new Set<string>();
    return stories
      .filter((s) => s.assignee)
      .reduce<User[]>((acc, s) => {
        if (!seen.has(s.assignee!.id)) {
          seen.add(s.assignee!.id);
          acc.push(s.assignee!);
        }
        return acc;
      }, []);
  }, [stories]);

  // Filtra las historias del sprint según los filtros activos del tablero.
  // Los filtros son aditivos (AND): se aplican ambos si están activos a la vez.
  const filteredStories = useMemo<UserStory[]>(() => {
    return stories.filter((s) => {
      if (filters.assigneeId && s.assigneeId !== filters.assigneeId) return false;
      if (filters.priority && s.priority !== filters.priority) return false;
      return true;
    });
  }, [stories, filters]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!sprint) {
    return (
      <div className={styles.empty}>
        <h2>{t('sprint.noActive')}</h2>
        <p>{t('sprint.noActiveSub')}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.sprintName}>{sprint.name}</h1>
          {sprint.goal && <p className={styles.goal}>{sprint.goal}</p>}
        </div>
        <div className={styles.headerRight}>
          {!zenMode && (
            <div className={styles.stats}>
              <span className={styles.stat}>
                {sprint.stats.completedStories}/{sprint.stats.totalStories} {t('sprint.stories')}
              </span>
              <span className={styles.stat}>
                {sprint.stats.completedPoints}/{sprint.stats.totalPoints} pts
              </span>
            </div>
          )}
          {!zenMode && (
            <Button variant="ghost" size="sm" onClick={() => setShowManageColumns(true)}>
              {t('board.manageColumns')}
            </Button>
          )}
          <Button
            variant={zenMode ? 'primary' : 'ghost'}
            size="sm"
            onClick={toggleZenMode}
            title={t('board.zenMode')}
          >
            {t('board.zenMode')}
          </Button>
        </div>
      </header>

      {!zenMode && (
        <BoardFilters
          assignees={assignees}
          filters={filters}
          onChange={setFilters}
          totalCount={stories.length}
          filteredCount={filteredStories.length}
        />
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className={styles.board}>
          {columns.map((col) => (
            <BoardColumn
              key={col.id}
              columnId={col.status as StoryStatus}
              label={DEFAULT_COLUMN_STATUSES.includes(col.status as typeof DEFAULT_COLUMN_STATUSES[number]) ? t(`status.${col.status}`) : col.title}
              stories={filteredStories.filter((s) => s.status === col.status)}
              wipLimit={col.wipLimit ?? undefined}
              draggable={canDrag}
              onCardClick={setSelectedStoryId}
              onBlockClick={setBlockingStoryId}
              onUnblockClick={setUnblockingStoryId}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeStory && <BoardCard story={activeStory} isDragging />}
        </DragOverlay>
      </DndContext>

      <UserStoryDetailPanel
        storyId={selectedStoryId}
        projectId={projectId ?? ''}
        epics={epics}
        onClose={() => setSelectedStoryId(null)}
      />

      {showManageColumns && projectId && (
        <ManageColumnsModal
          projectId={projectId}
          columns={columns}
          onClose={() => setShowManageColumns(false)}
        />
      )}

      {blockingStoryId && projectId && (() => {
        const story = stories.find((s) => s.id === blockingStoryId);
        return story ? (
          <BlockStoryModal
            storyId={story.id}
            storyTitle={story.title}
            projectId={projectId}
            onClose={() => setBlockingStoryId(null)}
          />
        ) : null;
      })()}

      {unblockingStoryId && projectId && (() => {
        const story = stories.find((s) => s.id === unblockingStoryId);
        return story ? (
          <UnblockStoryModal
            storyId={story.id}
            storyTitle={story.title}
            blockedReason={story.blockedReason}
            projectId={projectId}
            onClose={() => setUnblockingStoryId(null)}
          />
        ) : null;
      })()}

      {dodPending && projectId && (
        <DodValidationModal
          projectId={projectId}
          storyTitle={dodPending.story.title}
          onConfirm={(override) => { setDodPending(null); dodPending.resolve(true); void override; }}
          onCancel={() => { setDodPending(null); dodPending.resolve(false); }}
        />
      )}
    </div>
  );
}
