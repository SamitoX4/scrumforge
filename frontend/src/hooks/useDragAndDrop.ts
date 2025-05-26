/**
 * @file useDragAndDrop.ts
 * @description Hook genérico de drag & drop construido sobre dnd-kit.
 *
 * Abstrae la configuración repetitiva de dnd-kit (sensors, active-item tracking,
 * manejo del evento de fin de drag) en una interfaz simple y tipada. Los componentes
 * que lo usan solo necesitan proporcionar la lista de ítems y un callback `onDrop`.
 *
 * A diferencia de `useBoardDnd` (específico del tablero Kanban con lógica de DoD
 * y actualizaciones optimistas de Apollo), este hook es completamente genérico
 * y puede usarse en cualquier contexto de drag & drop: backlog, sprint planning,
 * ordenación de epics, etc.
 */
import { useState } from 'react';
import {
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

/**
 * Opciones de configuración para el hook genérico de drag & drop.
 *
 * @template T - Tipo de los ítems que se pueden arrastrar.
 * @property items              - Lista completa de ítems disponibles para arrastrar.
 * @property getId              - Función que extrae el ID único de arrastre de un ítem.
 * @property onDrop             - Callback ejecutado cuando un drag termina sobre un destino válido.
 * @property activationDistance - Píxeles de movimiento antes de activar el drag (default: 8px).
 */
export interface UseDragAndDropOptions<T> {
  /** Lista completa de ítems disponibles para arrastrar. */
  items: T[];
  /** Extrae el ID arrastrable de un ítem. */
  getId: (item: T) => string;
  /**
   * Llamado cuando un drag termina sobre un destino válido.
   * @param draggedId  - ID del ítem arrastrado.
   * @param targetId   - ID de la zona de drop / ítem destino.
   */
  onDrop: (draggedId: string, targetId: string) => void | Promise<void>;
  /** Movimiento mínimo del puntero antes de activar el drag (por defecto: 8px). */
  activationDistance?: number;
}

/**
 * Resultado devuelto por el hook.
 *
 * @template T - Tipo de los ítems.
 * @property activeItem     - Ítem actualmente en arrastre (null cuando está inactivo).
 * @property sensors        - Configuración de sensores para `<DndContext sensors={...}>`.
 * @property handleDragStart- Handler para el evento `onDragStart`.
 * @property handleDragEnd  - Handler para el evento `onDragEnd`.
 */
export interface UseDragAndDropResult<T> {
  /** Ítem siendo arrastrado actualmente (null cuando está inactivo). */
  activeItem: T | null;
  sensors: ReturnType<typeof useSensors>;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void | Promise<void>;
}

/**
 * Hook genérico de drag & drop construido sobre dnd-kit.
 *
 * Encapsula la configuración del PointerSensor, el tracking del ítem activo
 * y el callback `onDrop`, de modo que las vistas individuales solo necesitan
 * implementar su lógica de reordenación o movimiento.
 *
 * @template T - Tipo de los ítems que se pueden arrastrar.
 * @param options - Configuración del hook.
 * @returns Estado y handlers listos para pasar al `<DndContext>` de dnd-kit.
 *
 * @example
 * const { activeItem, sensors, handleDragStart, handleDragEnd } = useDragAndDrop({
 *   items: stories,
 *   getId: (s) => s.id,
 *   onDrop: (storyId, sprintId) => moveToSprint(storyId, sprintId),
 * });
 */
export function useDragAndDrop<T>({
  items,
  getId,
  onDrop,
  activationDistance = 8,
}: UseDragAndDropOptions<T>): UseDragAndDropResult<T> {
  // Ítem en vuelo — null cuando no hay drag activo
  const [activeItem, setActiveItem] = useState<T | null>(null);

  // PointerSensor: el drag no inicia hasta que el puntero se mueve `activationDistance` px,
  // lo que evita disparar un drag al hacer click normal sobre un elemento.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: activationDistance },
    }),
  );

  /**
   * Registra el ítem que comienza a arrastrarse para poder alimentar el DragOverlay.
   */
  function handleDragStart(event: DragStartEvent) {
    const found = items.find((item) => getId(item) === event.active.id);
    setActiveItem(found ?? null);
  }

  /**
   * Finaliza el drag: limpia el ítem activo e invoca `onDrop` si hay destino válido.
   * Se cancela si se suelta sobre el mismo ítem de origen (sin movimiento).
   */
  async function handleDragEnd(event: DragEndEvent) {
    // Limpiar el ítem en vuelo inmediatamente, independientemente del resultado
    setActiveItem(null);
    const { active, over } = event;
    // Si no hay destino o el ítem se soltó sobre sí mismo, no hay nada que hacer
    if (!over || active.id === over.id) return;
    await onDrop(active.id as string, over.id as string);
  }

  return { activeItem, sensors, handleDragStart, handleDragEnd };
}
