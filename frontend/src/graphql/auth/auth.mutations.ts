/**
 * @file auth.mutations.ts
 * @description Mutaciones GraphQL relacionadas con autenticación y gestión de sesión.
 *
 * Todas las mutaciones que devuelven tokens usan el fragmento `UserFields`
 * para garantizar que el store de autenticación (auth.store.ts) siempre
 * reciba un objeto de usuario consistente, independientemente de si se llama
 * a login, register o refreshTokens.
 */

// src/graphql/auth/auth.mutations.ts
import { gql } from '@apollo/client';

/**
 * Fragmento reutilizable con los campos del usuario autenticado.
 *
 * Se define como fragmento (y no inline) para que Apollo Client pueda
 * normalizar y cachear correctamente el objeto `User` en todas las mutaciones
 * de autenticación, evitando duplicar la selección de campos en cada query.
 *
 * `emailVerified` se incluye para que la UI pueda mostrar banners o bloquear
 * funcionalidad hasta que el usuario verifique su correo electrónico.
 */
const USER_FIELDS = gql`
  fragment UserFields on User {
    id
    email
    name
    avatarUrl
    emailVerified
  }
`;

/**
 * Mutación de inicio de sesión con email y contraseña.
 *
 * Devuelve el par de tokens JWT (accessToken de corta vida + refreshToken
 * de larga vida) junto con los datos del usuario para hidratar el store
 * de autenticación sin necesidad de una query adicional.
 *
 * El accessToken se almacena en localStorage; el refreshToken también, dado
 * que la app requiere persistencia de sesión entre recargas. En entornos
 * de alta seguridad se podría migrar el refreshToken a una cookie HttpOnly.
 *
 * Variables esperadas: `{ input: { email: string, password: string } }`
 */
export const LOGIN_MUTATION = gql`
  ${USER_FIELDS}
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      refreshToken
      user { ...UserFields }
    }
  }
`;

/**
 * Mutación de registro de nuevo usuario.
 *
 * Al igual que LOGIN_MUTATION, devuelve tokens + usuario para que el flujo
 * de registro inicie sesión automáticamente sin redirigir al login.
 * Esto mejora la experiencia de onboarding al reducir los pasos para llegar
 * al dashboard por primera vez.
 *
 * Variables esperadas: `{ input: { name: string, email: string, password: string } }`
 */
export const REGISTER_MUTATION = gql`
  ${USER_FIELDS}
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accessToken
      refreshToken
      user { ...UserFields }
    }
  }
`;

/**
 * Mutación de cierre de sesión.
 *
 * Envía el refreshToken al servidor para que sea invalidado en la lista
 * de tokens activos (revocación del lado del servidor). Solo después de
 * la revocación el cliente elimina los tokens de localStorage.
 * Esto previene que tokens robados sigan siendo válidos tras el logout.
 *
 * Devuelve un booleano que indica si la revocación fue exitosa.
 *
 * Variables esperadas: `{ refreshToken: string }`
 */
export const LOGOUT_MUTATION = gql`
  mutation Logout($refreshToken: String!) {
    logout(refreshToken: $refreshToken)
  }
`;

/**
 * Mutación de renovación de tokens (token refresh).
 *
 * Se llama automáticamente cuando el accessToken expira (típicamente
 * gestionado por un interceptor o por el errorLink de Apollo al recibir
 * un error UNAUTHENTICATED). Intercambia el refreshToken vigente por
 * un nuevo par de tokens, manteniendo la sesión activa sin pedir al
 * usuario que vuelva a autenticarse.
 *
 * Devuelve también el usuario actualizado para sincronizar el store
 * si el perfil cambió desde el último login.
 *
 * Variables esperadas: `{ refreshToken: string }`
 */
export const REFRESH_TOKENS_MUTATION = gql`
  ${USER_FIELDS}
  mutation RefreshTokens($refreshToken: String!) {
    refreshTokens(refreshToken: $refreshToken) {
      accessToken
      refreshToken
      user { ...UserFields }
    }
  }
`;
