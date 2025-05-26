import { useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { UserStory } from '@/types/api.types';
import { PriorityBadge } from '@/components/atoms/Badge/Badge';
import { Avatar } from '@/components/atoms/Avatar/Avatar';
import { DropdownMenu } from '@/components/molecules/DropdownMenu/DropdownMenu';
import styles from './BoardCard.module.scss';

/**
 * Props del componente BoardCard.
 */
interface BoardCardProps {
  /** Historia de usuario que representa esta tarjeta. */
  story: UserStory;
  /**
   * Indica si la tarjeta es el "ghost" que viaja con el cursor durante el drag.
   * Se usa en el DragOverlay para renderizar una copia visual flotante.
   */
  isDragging?: boolean;
  /**
   * Permite deshabilitar el drag (ej. cuando el usuario no tiene permisos
   * para mover tarjetas en el tablero).
   */
  draggable?: boolean;
  /** Callback al hacer clic en la tarjeta para abrir el panel de detalle. */
  onCardClick?: (storyId: string) => void;
  /** Callback al copiar el título desde el menú contextual. */
  onCopyTitle?: (title: string) => void;
  /** Callback para abrir el modal de bloqueo de la historia. */
  onBlockClick?: (storyId: string) => void;
  /** Callback para abrir el modal de desbloqueo de la historia. */
  onUnblockClick?: (storyId: string) => void;
}

/**
 * BoardCard
 *
 * Tarjeta del tablero Kanban que representa una historia de usuario.
 *
 * Gestión del drag-and-drop:
 * - Usa `useDraggable` de dnd-kit para activar el drag al presionar la tarjeta.
 * - Cuando la tarjeta es la que se está arrastrando (`isBeingDragged`),
 *   se renderiza como un placeholder transparente para mantener la altura
 *   de la columna mientras la copia visible flota en el `DragOverlay`.
 * - Para distinguir entre un clic simple y el inicio de un drag, se usa
 *   una referencia `pointerMoved` que se activa con `onPointerMove`.
 *   Así no se abre el panel de detalle al finalizar un drag.
 *
 * Estados visuales:
 * - Tarjeta bloqueada: badge rojo "Bloqueada" en la parte superior.
 * - Tarjeta con épica: chip de color con el nombre de la épica.
 * - Tarjeta siendo arrastrada: clase CSS `card--dragging` para opacidad reducida.
 *
 * @param story - Historia de usuario a representar.
 * @param isDragging - True si esta instancia es el ghost en DragOverlay.
 * @param draggable - False para deshabilitar el drag (control de permisos).
 * @param onCardClick - Abre el panel de detalle de la historia.
 * @param onCopyTitle - Copia el título al portapapeles.
 * @param onBlockClick - Abre el modal para bloquear la historia.
 * @param onUnblockClick - Abre el modal para desbloquear la historia.
 */
export function BoardCard({ story, isDragging = false, draggable = true, onCardClick, onCopyTitle, onBlockClick, onUnblockClick }: BoardCardProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, isDragging: isBeingDragged } =
    useDraggable({ id: story.id, disabled: !draggable });

  // Bandera para distinguir entre un clic simple (false) y el fin de un drag (true)
  const pointerMoved = useRef(false);

  /**
   * Solo dispara `onCardClick` si el puntero no se movió durante el evento
   * (es decir, fue un clic puro, no el inicio de un arrastre).
   */
  function handleClick() {
    if (!pointerMoved.current && !isBeingDragged && onCardClick) {
      onCardClick(story.id);
    }
  }

  /**
   * Cuando esta tarjeta es la que se está arrastrando, renderizar solo
   * un placeholder transparente para mantener el espacio en la columna.
   * La copia visual flotante se renderiza en el DragOverlay del padre.
   */
  if (isBeingDragged) {
    return <div ref={setNodeRef} className={clsx(styles.card, styles['card--placeholder'])} />;
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      // Fusionar el onPointerDown de dnd-kit con nuestro propio handler
      // para que el drag siga funcionando y a la vez podamos rastrear el movimiento
      onPointerDown={(e) => {
        pointerMoved.current = false;
        listeners?.onPointerDown?.(e);
      }}
      onPointerMove={() => { pointerMoved.current = true; }}
      onClick={handleClick}
      className={clsx(
        styles.card,
        isDragging && styles['card--dragging'],
        onCardClick && styles['card--clickable'],
        story.isBlocked && styles['card--blocked'],
      )}
    >
      {/* Badge de bloqueo — solo visible si la historia está marcada como bloqueada */}
      {story.isBlocked && (
        <div className={styles.blockedBadge} title={story.blockedReason ?? t('board.blockedTitle')}>
          {t('board.blocked')}
        </div>
      )}

      {/* Chip de épica con color de la épica para identificación visual rápida */}
      {story.epic && (
        <span
          className={styles.epicLabel}
          style={{ color: story.epic.color, borderColor: story.epic.color }}
        >
          {story.epic.title}
        </span>
      )}

      <p className={styles.title}>{story.title}</p>

      <div className={styles.footer}>
        <PriorityBadge priority={story.priority} />
        <div className={styles.right}>
          {/* Puntos de la historia — solo si están estimados */}
          {story.points != null && (
            <span className={styles.points}>{story.points}</span>
          )}
          {story.assignee && (
            <Avatar
              name={story.assignee.name}
              avatarUrl={story.assignee.avatarUrl}
              size="xs"
            />
          )}
          {/* Menú contextual con acciones: ver detalle, copiar título, bloquear/desbloquear */}
          <DropdownMenu
            trigger={<span className={styles.menuBtn} aria-label={t('board.options')}>⋮</span>}
            items={[
              ...(onCardClick ? [{ label: t('board.viewDetail'), icon: '👁', action: () => onCardClick(story.id) }] : []),
              {
                label: t('board.copyTitle'),
                icon: '📋',
                // Intentar copiar al portapapeles del sistema; ignorar errores si no está disponible
                action: () => { onCopyTitle?.(story.title); navigator.clipboard.writeText(story.title).catch(() => {}); },
              },
              // Mostrar "Resolver bloqueo" solo si la historia ya está bloqueada
              ...(story.isBlocked && onUnblockClick
                ? [{ label: t('board.resolveBlock'), icon: '✅', action: () => onUnblockClick(story.id) }]
                : []),
              // Mostrar "Marcar bloqueada" solo si la historia NO está bloqueada
              ...(!story.isBlocked && onBlockClick
                ? [{ label: t('board.markBlocked'), icon: '🚫', action: () => onBlockClick(story.id) }]
                : []),
            ]}
          />
        </div>
      </div>
    </div>
  );
}
