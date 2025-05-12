import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import type { UserStory } from '@/types/api.types';
import styles from './PlanningStoryCard.module.scss';

/**
 * Props del componente PlanningStoryCard.
 */
interface PlanningStoryCardProps {
  /** Historia de usuario que representa esta tarjeta. */
  story: UserStory;
  /**
   * Indica que esta instancia se renderiza como copia estática dentro del DragOverlay.
   * Cuando es `true`, el drag queda deshabilitado para evitar arrastres anidados
   * y no se propagan los listeners de dnd-kit al elemento DOM.
   */
  isOverlay?: boolean;
}

/**
 * PlanningStoryCard
 *
 * Tarjeta arrastrable que representa una historia de usuario en la vista de
 * planificación de sprints. Se usa en dos contextos distintos:
 *
 * 1. **Lista del backlog**: instancia normal con `isOverlay = false`.
 *    El hook `useDraggable` registra la tarjeta como elemento arrastrable.
 *    La transformación CSS calculada por dnd-kit se aplica en el estilo inline
 *    para que la tarjeta siga al cursor durante el drag.
 *
 * 2. **DragOverlay**: instancia "fantasma" con `isOverlay = true`.
 *    El drag está deshabilitado y los listeners no se propagan, ya que esta
 *    copia solo sirve de representación visual flotante. Su clase CSS añade
 *    la sombra elevada que indica que el objeto está en el aire.
 *
 * @param story - Historia de usuario a mostrar.
 * @param isOverlay - `true` cuando la tarjeta es el ghost del DragOverlay.
 */
export function PlanningStoryCard({ story, isOverlay = false }: PlanningStoryCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: story.id,
    // Deshabilitar el drag en la copia del overlay para evitar comportamientos inesperados
    disabled: isOverlay,
  });

  // Aplicar la transformación de posición solo cuando se está arrastrando;
  // `undefined` como style no modifica el posicionamiento base del elemento.
  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        styles.card,
        // Reducir opacidad de la tarjeta original mientras su copia flota en el overlay
        isDragging && styles['card--dragging'],
        // Estilo elevado para la copia flotante en el DragOverlay
        isOverlay && styles['card--overlay'],
      )}
      // Los listeners y attributes de dnd-kit solo se propagan en la instancia real,
      // nunca en la copia del overlay (que debe ser puramente visual).
      {...(isOverlay ? {} : listeners)}
      {...(isOverlay ? {} : attributes)}
      aria-label={`Arrastrar: ${story.title}`}
    >
      {/* Icono visual de agarre; oculto para lectores de pantalla (aria-hidden) */}
      <span className={styles.dragHandle} aria-hidden>⠿</span>
      <span className={styles.title}>{story.title}</span>
      <div className={styles.meta}>
        {/* Mostrar puntos solo si la historia ha sido estimada (points != null) */}
        {story.points != null && (
          <span className={styles.points}>{story.points} pts</span>
        )}
      </div>
    </div>
  );
}
