import { useDroppable } from '@dnd-kit/core';
import clsx from 'clsx';
import styles from './SprintDropZone.module.scss';

/**
 * Props del componente SprintDropZone.
 */
interface SprintDropZoneProps {
  /** ID del sprint, usado como identificador del droppable en el contexto DnD */
  sprintId: string;
  children: React.ReactNode;
  /** Si es true, deshabilita la zona como destino de drop (ej. sprint cerrado o activo) */
  disabled?: boolean;
}

/**
 * @component SprintDropZone
 * @description Zona receptora de drag-and-drop que envuelve el contenido de un sprint
 * en la vista de planificación. Permite asignar historias del backlog a un sprint
 * arrastrándolas sobre él.
 *
 * Cuando una historia pasa sobre la zona, se añade la clase `zone--over` que
 * proporciona retroalimentación visual (borde destacado, fondo sutil) y se muestra
 * un mensaje flotante "Soltar aquí" para guiar al usuario.
 *
 * El prop `disabled` desactiva el droppable para sprints que no deben recibir
 * historias (ej. sprints completados o el sprint activo si solo se permite
 * planificar sprints futuros).
 *
 * @param props.sprintId - ID único del sprint, registrado como droppable en dnd-kit
 * @param props.children - Contenido del sprint (lista de historias, header, etc.)
 * @param props.disabled - Si true, la zona no acepta drops; por defecto false
 */
export function SprintDropZone({ sprintId, children, disabled = false }: SprintDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: sprintId, disabled });

  return (
    <div
      ref={setNodeRef}
      className={clsx(styles.zone, isOver && styles['zone--over'])}
      aria-label={`Zona de sprint: soltar historias aquí`}
    >
      {children}
      {/* El hint de drop solo aparece cuando hay una historia encima de la zona,
          y se marca como aria-hidden porque la info ya está en aria-label del contenedor */}
      {isOver && (
        <div className={styles.dropHint} aria-hidden>
          Soltar aquí para añadir al sprint
        </div>
      )}
    </div>
  );
}
