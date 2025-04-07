/**
 * @file board.store.ts
 * @description Store global del tablero Kanban — mantiene el estado local de las
 * historias durante las operaciones de arrastre (drag & drop) para permitir
 * actualizaciones optimistas sin esperar la confirmación del servidor.
 *
 * Este store NO persiste en localStorage porque su contenido debe siempre
 * sincronizarse con la respuesta de Apollo al montar el tablero.
 *
 * Flujo de datos:
 * 1. `useActiveSprint` obtiene las historias del servidor vía Apollo.
 * 2. El tablero llama a `setStories` para poblar este store.
 * 3. `useBoardDnd` llama a `moveStory` para mover una tarjeta optimísticamente.
 * 4. Si el servidor confirma, Apollo actualiza su caché y el store queda en sync.
 * 5. Si el servidor rechaza, Apollo revierte el caché; el componente re-lee los datos.
 */
import { create } from 'zustand';
import type { UserStory } from '@/types/api.types';

/**
 * Forma del estado del tablero.
 *
 * @property stories    - Lista local de historias del sprint activo.
 * @property isDragging - Indica si hay un drag en curso; permite estilizar el tablero.
 * @property setStories - Reemplaza la lista completa (sincronización con Apollo).
 * @property moveStory  - Mueve una historia a un nuevo estado (actualización optimista).
 * @property setDragging- Actualiza la bandera de arrastre activo.
 */
interface BoardState {
  /** Estado optimista para drag & drop */
  stories: UserStory[];
  isDragging: boolean;
  setStories: (stories: UserStory[]) => void;
  moveStory: (storyId: string, newStatus: string) => void;
  setDragging: (isDragging: boolean) => void;
}

/**
 * Hook-store del tablero Kanban.
 *
 * No se usa el middleware `persist` intencionadamente: el tablero debe
 * reflejar siempre los datos frescos del servidor al montar la página.
 */
export const useBoardStore = create<BoardState>((set) => ({
  // Estado inicial vacío — se rellena cuando Apollo devuelve el sprint activo
  stories: [],
  isDragging: false,

  /**
   * Reemplaza la lista completa de historias.
   * Llamado desde el componente del tablero cada vez que Apollo devuelve datos frescos.
   */
  setStories: (stories) => set({ stories }),

  /**
   * Actualiza el estado de una historia por ID.
   * Esta es la operación optimista: modifica el store local de inmediato mientras
   * Apollo espera la respuesta del servidor. El cast de tipo es necesario porque
   * `newStatus` llega como string desde el id del droppable de dnd-kit.
   */
  moveStory: (storyId, newStatus) =>
    set((state) => ({
      stories: state.stories.map((s) =>
        s.id === storyId ? { ...s, status: newStatus as UserStory['status'] } : s,
      ),
    })),

  /** Marca si hay un drag activo para aplicar estilos visuales al tablero. */
  setDragging: (isDragging) => set({ isDragging }),
}));
