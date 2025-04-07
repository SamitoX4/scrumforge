/**
 * @file useAuth.ts
 * @description Hook de autenticación — expone las operaciones de login, registro
 * y logout junto con el estado de sesión del usuario.
 *
 * Orquesta tres capas:
 * 1. Las mutaciones GraphQL (Apollo) para comunicarse con el servidor.
 * 2. El store Zustand (`useAuthStore`) para persistir la sesión localmente.
 * 3. La navegación de React Router para redirigir al usuario tras cada operación.
 *
 * Al separar esta lógica en un hook, los formularios de Login/Register solo
 * necesitan llamar a `login(email, password)` sin conocer los detalles de
 * la comunicación con el servidor ni de la persistencia de tokens.
 */
import { useMutation } from '@apollo/client/react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { apolloClient } from '@/graphql/client';
import {
  LOGIN_MUTATION,
  REGISTER_MUTATION,
  LOGOUT_MUTATION,
} from '@/graphql/auth/auth.mutations';
import { GET_WORKSPACES } from '@/graphql/workspace/workspace.queries';
import { ROUTES } from '@/constants/routes';
import type { AuthPayload, Workspace } from '@/types/api.types';

/**
 * Hook que encapsula todas las operaciones de autenticación.
 *
 * @returns Objeto con el usuario activo, estado de autenticación y las
 *          funciones `login`, `register`, `logout` y el flag `loading`.
 *
 * @example
 * const { login, loading } = useAuth();
 * await login(email, password); // redirige automáticamente al workspace
 */
export function useAuth() {
  const { user, isAuthenticated, setAuth, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  // Las mutaciones se instancian aquí para reutilizar el caché de Apollo
  const [loginMutation, { loading: loginLoading }] = useMutation<{ login: AuthPayload }>(
    LOGIN_MUTATION,
  );
  const [registerMutation, { loading: registerLoading }] = useMutation<{
    register: AuthPayload;
  }>(REGISTER_MUTATION);
  // LOGOUT_MUTATION invalida el refresh token en el servidor; el error se ignora
  // porque el logout local siempre debe completarse aunque falle el servidor.
  const [logoutMutation] = useMutation<any>(LOGOUT_MUTATION);

  /**
   * Autentica al usuario con email y contraseña.
   *
   * Tras un login exitoso:
   * 1. Guarda los tokens y datos de usuario en el store.
   * 2. Consulta los workspaces disponibles para determinar el destino.
   * 3. Navega al primer workspace o al onboarding si no tiene ninguno.
   *
   * @param email    - Email del usuario.
   * @param password - Contraseña en texto plano (el cifrado ocurre en el servidor).
   */
  async function login(email: string, password: string) {
    const result = await loginMutation({ variables: { input: { email, password } } });
    const payload = result.data?.login;
    if (payload) {
      setAuth(payload.user, payload.accessToken, payload.refreshToken);
      // Consultar workspaces para saber dónde navegar post-login
      try {
        const wsResult = await apolloClient.query<{ workspaces: Workspace[] }>({
          query: GET_WORKSPACES,
          // `network-only` garantiza datos frescos e ignora el caché de Apollo,
          // evitando que un caché de sesión anterior cause una redirección incorrecta.
          fetchPolicy: 'network-only',
        });
        const workspaces = wsResult.data?.workspaces ?? [];
        if (workspaces.length > 0) {
          // Navegar al primer workspace disponible
          navigate(`/${workspaces[0].slug}`);
        } else {
          // Sin workspaces → flujo de onboarding para crear el primero
          navigate(ROUTES.ONBOARDING);
        }
      } catch {
        // Si la query de workspaces falla, redirigir al onboarding como fallback seguro
        navigate(ROUTES.ONBOARDING);
      }
    }
  }

  /**
   * Registra un nuevo usuario y lo autentica directamente.
   *
   * Los usuarios nuevos siempre van al onboarding porque aún no tienen workspace.
   *
   * @param name     - Nombre completo del usuario.
   * @param email    - Email único del usuario.
   * @param password - Contraseña elegida por el usuario.
   */
  async function register(name: string, email: string, password: string) {
    const result = await registerMutation({
      variables: { input: { name, email, password } },
    });
    const payload = result.data?.register;
    if (payload) {
      setAuth(payload.user, payload.accessToken, payload.refreshToken);
      navigate(ROUTES.ONBOARDING);
    }
  }

  /**
   * Cierra la sesión del usuario.
   *
   * Orden de operaciones:
   * 1. Invalidar el refresh token en el servidor (fire & forget — los errores se ignoran).
   * 2. Limpiar el store local (tokens + datos de usuario).
   * 3. Limpiar el caché de Apollo para evitar fugas de datos entre sesiones.
   * 4. Navegar al login.
   *
   * Limpiar Apollo antes de navegar evita que queries activas en el árbol
   * de componentes lancen requests con el token ya eliminado.
   */
  async function logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      // Intentar invalidar el refresh token; los errores se ignoran para no bloquear el logout
      await logoutMutation({ variables: { refreshToken } }).catch(() => {});
    }
    clearAuth();
    // Vaciar el caché de Apollo para que no queden datos del usuario anterior
    await apolloClient.clearStore();
    navigate(ROUTES.LOGIN);
  }

  return {
    user,
    isAuthenticated,
    login,
    register,
    logout,
    // `loading` combina ambas mutaciones para que el formulario pueda mostrar un único spinner
    loading: loginLoading || registerLoading,
  };
}
