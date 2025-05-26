/**
 * @file useBoardDnd.ts
 * @description Hook de drag & drop para el tablero Kanban.
 *
 * Encapsula toda la lógica de arrastre de tarjetas entre columnas:
 * - Configuración de sensores de dnd-kit (activación con 8px de movimiento
 *   para evitar drags accidentales al hacer click).
 * - Tracking de la tarjeta en vuelo (para renderizar el DragOverlay).
 * - Validación del destino (solo columnas válidas, no otras tarjetas).
 * - Intercepción de movimientos a DONE para ejecutar validación de DoD.
 * - Actualización optimista vía `optimisticResponse` de Apollo para que
 *   la tarjeta se mueva instantáneamente sin esperar al servidor.
 */
import { useState } from 'react';
import {
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useMutation } from '@apollo/client/react';
import { UPDATE_USER_STORY } from '@/graphql/backlog/backlog.mutations';
import { useUIStore } from '@/store/ui.store';
import type { UserStory, StoryStatus } from '@/types/api.types';

/**
 * Opciones de configuración para el hook.
 *
 * @property stories            - Lista completa de historias del sprint activo.
 *                                Se usa para resolver la tarjeta arrastrada por ID.
 * @property onBeforeMoveToDone - Callback asíncrono que se ejecuta antes de mover
 *                                una historia al estado DONE. Debe devolver `true`
 *                                para confirmar el movimiento o `false` para cancelarlo.
 *                                Se usa para mostrar el modal de validación de DoD.
 */
interface UseBoardDndOptions {
  /** Todas las historias del sprint activo — usadas para resolver la tarjeta arrastrada. */
  stories: UserStory[];
  /**
   * Llamado antes de mover una historia a DONE. Debe resolver a true (continuar) o false (cancelar).
   * Se usa para mostrar el modal de validación de Definición de Hecho (DoD).
   */
  onBeforeMoveToDone?: (story: UserStory) => Promise<boolean>;
}

/**
 * Resultado devuelto por el hook.
 *
 * @property activeStory      - Historia actualmente en vuelo (para DragOverlay), o null.
 * @property sensors          - Configuración de sensores para pasar a `<DndContext>`.
 * @property handleDragStart  - Handler para el evento `onDragStart` de dnd-kit.
 * @property handleDragEnd    - Handler para el evento `onDragEnd` de dnd-kit.
 */
interface UseBoardDndResult {
  /** Historia siendo arrastrada actualmente (para DragOverlay). */
  activeStory: UserStory | null;
  sensors: ReturnType<typeof useSensors>;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
}

/**
 * Hook de drag & drop del tablero Kanban.
 *
 * Usa actualizaciones optimistas para que la tarjeta se mueva de columna
 * de forma instantánea sin esperar la respuesta del servidor. Si el servidor
 * devuelve un error, Apollo revierte automáticamente el caché al estado original.
 *
 * @param options - Configuración del hook (lista de historias y callback opcional de DoD).
 * @returns Handlers y estado de arrastre listos para usar en `<DndContext>`.
 */
export function useBoardDnd({ stories, onBeforeMoveToDone }: UseBoardDndOptions): UseBoardDndResult {
  const { addToast } = useUIStore();
  // Historia en vuelo — se pasa al DragOverlay para renderizar la "sombra" de la tarjeta
  const [activeStory, setActiveStory] = useState<UserStory | null>(null);

  // PointerSensor con distancia de activación para distinguir click de drag
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const [updateStory] = useMutation<any>(UPDATE_USER_STORY);

  /**
   * Registra la historia que está siendo arrastrada.
   * Se usa para alimentar el DragOverlay y aplicar estilos a la columna origen.
   */
  function handleDragStart(event: DragStartEvent) {
    const story = stories.find((s) => s.id === event.active.id);
    if (story) setActiveStory(story);
  }

  // Columnas válidas del tablero — el `over.id` debe ser uno de estos valores
  // para que el drop sea sobre una columna y no sobre otra tarjeta
  const VALID_STATUSES: StoryStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

  /**
   * Procesa el final del drag: valida el destino, intercede el DoD si aplica,
   * y ejecuta la mutación con actualización optimista.
   */
  async function handleDragEnd(event: DragEndEvent) {
    // Limpiar el estado de arrastre independientemente del resultado
    setActiveStory(null);
    const { active, over } = event;
    // Si se soltó fuera de cualquier droppable, cancelar
    if (!over) return;

    const newStatus = over.id as StoryStatus;
    // Guardia: `over.id` debe ser un status de columna, no el ID de otra historia
    if (!VALID_STATUSES.includes(newStatus)) return;

    const story = stories.find((s) => s.id === active.id);
    // Cancelar si la historia no existe o ya está en el estado destino
    if (!story || story.status === newStatus) return;

    // Interceptar movimientos a DONE para validar la Definición de Hecho
    if (newStatus === 'DONE' && onBeforeMoveToDone) {
      const proceed = await onBeforeMoveToDone(story);
      if (!proceed) return;
    }

    try {
      await updateStory({
        variables: { id: story.id, input: { status: newStatus } },
        // Actualización optimista: Apollo actualiza el caché inmediatamente sin
        // esperar la respuesta del servidor. El tablero re-renderiza al instante
        // sin parpadeo. Si el servidor falla, Apollo revierte automáticamente.
        optimisticResponse: {
          updateUserStory: {
            __typename: 'UserStory',
            ...story,
            status: newStatus,
          },
        },
      });
    } catch {
      // Notificar el error al usuario; Apollo ya habrá revertido el caché
      addToast('Error al mover la tarea', 'error');
    }
  }

  return { activeStory, sensors, handleDragStart, handleDragEnd };
}
