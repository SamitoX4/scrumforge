import { useDroppable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import type { UserStory, StoryStatus } from '@/types/api.types';
import { BoardCard } from './BoardCard';
import clsx from 'clsx';
import styles from './BoardColumn.module.scss';

/**
 * Colores asociados a cada estado para el badge de conteo de tarjetas.
 * Cuando el límite WIP no está excedido se usa el color del estado;
 * si se excede, se aplica el color de error via la clase CSS `count--exceeded`.
 */
const STATUS_COUNT_COLORS: Record<StoryStatus, string> = {
  TODO: '#6B7280',
  IN_PROGRESS: '#3B82F6',
  IN_REVIEW: '#8B5CF6',
  DONE: '#10B981',
};

/**
 * Props del componente BoardColumn.
 */
interface BoardColumnProps {
  /** Estado del tablero que representa esta columna (sirve como id de drop zone). */
  columnId: StoryStatus;
  /** Etiqueta visible de la columna. */
  label: string;
  /** Historias que pertenecen a esta columna (con el estado `columnId`). */
  stories: UserStory[];
  /**
   * Límite Work-In-Progress de la columna.
   * Si las historias superan este límite, el badge de conteo se marca en rojo.
   */
  wipLimit?: number;
  /** Si es `false`, las tarjetas no son arrastrables (control de permisos). */
  draggable?: boolean;
  /** Callback para abrir el panel de detalle de una historia. */
  onCardClick?: (storyId: string) => void;
  /** Callback para abrir el modal de bloqueo. */
  onBlockClick?: (storyId: string) => void;
  /** Callback para abrir el modal de desbloqueo. */
  onUnblockClick?: (storyId: string) => void;
}

/**
 * BoardColumn
 *
 * Columna del tablero Kanban que actúa como zona de drop para dnd-kit.
 * Muestra las historias de un estado concreto y gestiona visualmente
 * el límite WIP y el estado de hover durante el drag.
 *
 * Funcionamiento con dnd-kit:
 * - `useDroppable` registra la columna como zona válida de soltado.
 * - El `id` del droppable es el `columnId` (el estado del tablero),
 *   lo que permite al hook `useBoardDnd` identificar el destino del drag.
 * - Cuando `isOver` es `true`, se aplica la clase `column--over` para
 *   dar retroalimentación visual de que se puede soltar aquí.
 *
 * Límite WIP:
 * - Si `wipLimit` está definido y las historias lo superan, el badge
 *   de conteo se muestra en rojo con el formato "N/límite".
 * - El tooltip del badge explica el motivo del color de alerta.
 *
 * @param columnId - Estado que identifica esta columna y la zona de drop.
 * @param label - Nombre visible de la columna.
 * @param stories - Historias a mostrar en esta columna.
 * @param wipLimit - Máximo de historias permitidas simultáneamente.
 * @param draggable - Controla si las tarjetas son arrastrables.
 * @param onCardClick - Abre el detalle de una historia.
 * @param onBlockClick - Inicia el flujo de bloqueo de una historia.
 * @param onUnblockClick - Inicia el flujo de desbloqueo de una historia.
 */
export function BoardColumn({ columnId, label, stories, wipLimit, draggable = true, onCardClick, onBlockClick, onUnblockClick }: BoardColumnProps) {
  const { t } = useTranslation();
  // `isExceeded` activa el estilo de alerta en el contador de tarjetas
  const isExceeded = wipLimit != null && stories.length > wipLimit;
  const { isOver, setNodeRef } = useDroppable({ id: columnId });

  return (
    <div className={clsx(styles.column, isOver && styles['column--over'])}>
      <header className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span
          className={clsx(styles.count, isExceeded && styles['count--exceeded'])}
          // Aplicar color del estado solo cuando no está excedido el límite WIP
          style={!isExceeded ? { backgroundColor: STATUS_COUNT_COLORS[columnId] } : undefined}
          title={isExceeded ? t('board.wipExceeded', { count: stories.length, limit: wipLimit }) : undefined}
        >
          {/* Mostrar "N/límite" si hay WIP configurado, solo "N" si no */}
          {wipLimit != null ? `${stories.length}/${wipLimit}` : stories.length}
        </span>
      </header>

      {/* Área de drop: ref de dnd-kit registrada aquí para detectar cuando se arrastra sobre ella */}
      <div ref={setNodeRef} className={styles.cards}>
        {stories.map((story) => (
          <BoardCard
            key={story.id}
            story={story}
            draggable={draggable}
            onCardClick={onCardClick}
            onBlockClick={onBlockClick}
            onUnblockClick={onUnblockClick}
          />
        ))}

        {/* Indicador de zona de drop vacía — aparece cuando no hay tarjetas
            y se resalta cuando hay un elemento siendo arrastrado sobre ella */}
        {stories.length === 0 && (
          <div className={clsx(styles.dropZone, isOver && styles['dropZone--active'])}>
            {t('board.dragHere')}
          </div>
        )}
      </div>
    </div>
  );
}
