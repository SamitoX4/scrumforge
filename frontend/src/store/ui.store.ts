/**
 * @file ui.store.ts
 * @description Store global de estado de UI — controla sidebar, modales, toasts,
 * paleta de comandos, modo Zen, filtros del backlog y tema visual.
 *
 * Usa Zustand con `persist` para sobrevivir recargas. Solo se persisten las
 * preferencias del usuario (sidebar, filtros guardados y tema); el resto del
 * estado es efímero y se resetea en cada carga de página.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Variante visual de un toast de notificación. */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Representa una notificación toast en cola.
 * @property id      - Identificador único generado al crear el toast.
 * @property message - Texto a mostrar al usuario.
 * @property type    - Variante visual que determina el color e icono.
 */
export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

/**
 * Estado de los filtros activos en la vista de Backlog.
 * Strings vacíos significan "sin filtro aplicado" para ese campo.
 */
export interface BacklogFilterState {
  epicId: string;
  status: string;
  priority: string;
}

/** Valor inicial de los filtros — todos vacíos (sin filtro activo). */
const INITIAL_BACKLOG_FILTERS: BacklogFilterState = { epicId: '', status: '', priority: '' };

/**
 * Un filtro de backlog guardado por el usuario para reutilización futura.
 * @property id      - UUID generado al guardar.
 * @property name    - Nombre descriptivo elegido por el usuario.
 * @property filters - Snapshot del estado de filtros en el momento de guardar.
 */
export interface SavedFilter {
  id: string;
  name: string;
  filters: BacklogFilterState;
}

/**
 * Forma completa del estado de UI expuesto por el store.
 * Agrupa tanto el estado como las acciones para facilitar la desestructuración
 * en los componentes consumidores con un único `useUIStore()`.
 */
interface UIState {
  /** Sidebar contraído (true) o expandido (false). */
  sidebarCollapsed: boolean;
  /** ID del modal actualmente abierto, o null si ninguno. */
  activeModal: string | null;
  /** Cola de toasts pendientes de mostrar. */
  toasts: Toast[];
  /** Si la paleta de comandos (Ctrl+K) está visible. */
  commandPaletteOpen: boolean;
  /** Modo Zen — oculta sidebar y header para máxima concentración. */
  zenMode: boolean;
  /** Filtros activos en el backlog del proyecto actual. */
  backlogFilters: BacklogFilterState;
  /** Filtros guardados por el usuario para reutilización. */
  savedFilters: SavedFilter[];
  /** Tema visual activo. */
  theme: 'light' | 'dark';

  // ── Acciones ──────────────────────────────────────────────────────────────
  toggleTheme: () => void;
  toggleSidebar: () => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleZenMode: () => void;
  exitZenMode: () => void;
  setBacklogFilters: (filters: BacklogFilterState) => void;
  resetBacklogFilters: () => void;
  saveFilter: (name: string, filters: BacklogFilterState) => void;
  deleteSavedFilter: (id: string) => void;
}

/**
 * Hook-store de UI.
 *
 * Solo se persisten `sidebarCollapsed`, `savedFilters` y `theme` porque son
 * preferencias del usuario que deben sobrevivir recargas. El resto del estado
 * (modales, toasts, paleta, zenMode, filtros activos) es efímero y no debe
 * persistirse para evitar comportamientos inesperados al recargar.
 */
export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // ── Estado inicial ──────────────────────────────────────────────────────
      sidebarCollapsed: false,
      activeModal: null,
      toasts: [],
      commandPaletteOpen: false,
      zenMode: false,
      backlogFilters: INITIAL_BACKLOG_FILTERS,
      savedFilters: [],
      theme: 'light',

      // ── Tema ───────────────────────────────────────────────────────────────

      /** Alterna entre modo claro y oscuro. ThemeApplier en App.tsx aplica el cambio al DOM. */
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

      // ── Sidebar ────────────────────────────────────────────────────────────

      /** Expande o contrae el sidebar. El layout ajusta su ancho via CSS. */
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      // ── Modales ────────────────────────────────────────────────────────────

      /**
       * Abre el modal identificado por `modalId`.
       * Solo puede haber un modal activo a la vez; abrir uno cierra el anterior.
       */
      openModal: (modalId) => set({ activeModal: modalId }),

      /** Cierra el modal activo. */
      closeModal: () => set({ activeModal: null }),

      // ── Paleta de comandos ─────────────────────────────────────────────────

      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),

      // ── Toasts ─────────────────────────────────────────────────────────────

      /**
       * Añade un toast a la cola y lo elimina automáticamente tras 4 segundos.
       * El ID se genera con Math.random para evitar dependencias de crypto en
       * contextos sin soporte (aunque se usa crypto para savedFilters).
       * Se usa `slice(2)` para eliminar el prefijo '0.' del número decimal.
       */
      addToast: (message, type = 'info') => {
        const id = Math.random().toString(36).slice(2);
        set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
        // Auto-dismiss tras 4 segundos — el usuario también puede cerrarlo manualmente
        setTimeout(() => {
          set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
        }, 4000);
      },

      /** Elimina un toast específico por ID (descarte manual por el usuario). */
      removeToast: (id) =>
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

      // ── Modo Zen ───────────────────────────────────────────────────────────

      /** Alterna el modo Zen (sin sidebar ni header). */
      toggleZenMode: () => set((state) => ({ zenMode: !state.zenMode })),
      /** Fuerza la salida del modo Zen sin alternar. */
      exitZenMode: () => set({ zenMode: false }),

      // ── Filtros de backlog ─────────────────────────────────────────────────

      /** Reemplaza el estado completo de los filtros activos. */
      setBacklogFilters: (filters) => set({ backlogFilters: filters }),
      /** Vuelve al estado sin filtros (todos los campos vacíos). */
      resetBacklogFilters: () => set({ backlogFilters: INITIAL_BACKLOG_FILTERS }),

      /**
       * Guarda el estado actual de los filtros con un nombre descriptivo.
       * Usa `crypto.randomUUID()` para generar IDs únicos y estables (soportado en
       * todos los navegadores modernos y en el worker de Vite).
       */
      saveFilter: (name, filters) =>
        set((state) => ({
          savedFilters: [
            ...state.savedFilters,
            { id: crypto.randomUUID(), name, filters },
          ],
        })),

      /** Elimina un filtro guardado por su ID. */
      deleteSavedFilter: (id) =>
        set((state) => ({
          savedFilters: state.savedFilters.filter((f) => f.id !== id),
        })),
    }),
    {
      // Clave en localStorage para la persistencia de este store
      name: 'scrumforge-ui',
      // Solo persistir preferencias del usuario; excluir estado efímero
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        savedFilters: state.savedFilters,
        theme: state.theme,
      }),
    },
  ),
);
