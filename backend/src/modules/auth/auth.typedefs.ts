/**
 * @file auth.typedefs.ts
 * @description Definiciones del esquema GraphQL para el módulo de autenticación.
 * Se usa `extend type Mutation` porque el tipo raíz `Mutation` se define en
 * el módulo de usuario (user.typedefs.ts) y aquí sólo se amplía.
 *
 * Flujo de tokens:
 *   1. El cliente llama a `register` o `login` y recibe `accessToken` + `refreshToken`.
 *   2. El `accessToken` se adjunta en la cabecera `Authorization: Bearer <token>`.
 *   3. Cuando el `accessToken` expira el cliente llama a `refreshTokens` con el
 *      `refreshToken` para obtener un par nuevo (rotación de tokens).
 *   4. `logout` invalida el `refreshToken` en base de datos.
 */
export const authTypeDefs = `#graphql
  """
  Respuesta devuelta en operaciones de autenticación exitosas.
  Contiene el par de tokens y los datos básicos del usuario autenticado.
  """
  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    user: User!
  }

  """
  Datos requeridos para crear una nueva cuenta de usuario.
  """
  input RegisterInput {
    name: String!
    email: String!
    password: String!
  }

  """
  Credenciales necesarias para iniciar sesión.
  """
  input LoginInput {
    email: String!
    password: String!
  }

  extend type Mutation {
    "Crea una nueva cuenta y devuelve tokens de sesión."
    register(input: RegisterInput!): AuthPayload!
    "Autentica al usuario y devuelve tokens de sesión."
    login(input: LoginInput!): AuthPayload!
    "Rota el par de tokens usando el refresh token actual."
    refreshTokens(refreshToken: String!): AuthPayload!
    "Invalida el refresh token, cerrando la sesión activa."
    logout(refreshToken: String!): Boolean!
  }
`;
