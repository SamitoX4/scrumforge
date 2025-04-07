/**
 * @file auth.store.ts
 * @description Store global de autenticación — gestiona la sesión del usuario,
 * tokens JWT y el slug del workspace activo.
 *
 * Usa Zustand con el middleware `persist` para sobrevivir recargas de página.
 * Los tokens también se duplican en `localStorage` (fuera del store) para que
 * el cliente Apollo pueda leerlos de forma síncrona sin acceder al store de
 * Zustand, lo que evita dependencias circulares en la inicialización.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types/api.types';

/**
 * Forma del estado de autenticación expuesto por el store.
 *
 * @property user                - Datos del usuario autenticado o null si no hay sesión.
 * @property accessToken         - JWT de corta duración usado en cada request HTTP/WS.
 * @property refreshToken        - Token de larga duración para renovar el accessToken.
 * @property isAuthenticated     - Bandera derivada; true cuando hay sesión activa.
 * @property currentWorkspaceSlug- Último workspace visitado; permite redirección instantánea sin red.
 * @property setAuth             - Persiste los tokens y datos de usuario tras un login/registro exitoso.
 * @property clearAuth           - Elimina toda la sesión (logout o expiración).
 * @property setCurrentWorkspaceSlug - Actualiza el slug del workspace activo.
 */
interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  currentWorkspaceSlug: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  setCurrentWorkspaceSlug: (slug: string) => void;
}

/**
 * Hook-store de autenticación.
 *
 * El middleware `persist` serializa el estado a `localStorage` bajo la clave
 * `scrumforge-auth`. Solo se persisten los campos listados en `partialize`
 * para evitar guardar funciones o estado efímero.
 *
 * La función `merge` personalizada sanitiza el estado rehidratado para eliminar
 * valores corruptos (ej. `:workspaceSlug` literal de React Router) que pudieran
 * haberse guardado en versiones anteriores de la app.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Estado inicial — sin sesión activa
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      currentWorkspaceSlug: null,

      /**
       * Guarda la sesión del usuario tras un login o registro exitoso.
       * Duplica los tokens en localStorage para que Apollo los lea sincrónicamente
       * sin tener que inyectar el store en el cliente GraphQL.
       */
      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },

      /**
       * Limpia toda la sesión: elimina tokens de localStorage y resetea el store.
       * Llamado tanto en logout explícito como en expiración detectada por el errorLink de Apollo.
       */
      clearAuth: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, currentWorkspaceSlug: null });
      },

      /**
       * Persiste el slug del workspace activo para permitir redirección instantánea
       * en `RootRedirect` sin necesidad de hacer una query de red.
       * Se rechaza el slug si es un patrón de ruta de React Router (`:workspaceSlug`)
       * para evitar que una navegación mal formada corrompa el store.
       */
      setCurrentWorkspaceSlug: (slug) => {
        // Rechazar patrones de ruta como ':workspaceSlug' — solo aceptar slugs reales
        if (!slug || slug.startsWith(':')) return;
        set({ currentWorkspaceSlug: slug });
      },
    }),
    {
      // Clave en localStorage donde Zustand serializa este store
      name: 'scrumforge-auth',
      // Solo persistir datos de sesión; excluir las funciones (no serializables)
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        currentWorkspaceSlug: state.currentWorkspaceSlug,
      }),
      // Sanitizar el estado rehidratado al iniciar la app — eliminar slugs corruptos
      // que pudieran haberse guardado como patrones de ruta en versiones anteriores.
      merge: (persisted, current) => {
        const p = persisted as Partial<AuthState>;
        const slug = p.currentWorkspaceSlug;
        return {
          ...current,
          ...p,
          // Si el slug empieza con ':' es un patrón de ruta; descartarlo
          currentWorkspaceSlug: slug && !slug.startsWith(':') ? slug : null,
        };
      },
    },
  ),
);
