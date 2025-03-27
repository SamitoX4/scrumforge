/**
 * @file user.typedefs.ts
 * @description Definiciones del esquema GraphQL para el módulo de usuarios.
 *
 * Este archivo define el tipo raíz `Query` y el tipo `User`.
 * Los demás módulos extienden `Query` y `Mutation` con `extend type`.
 *
 * El campo `emailVerified` es un campo derivado calculado en el resolver a partir
 * de `emailVerifiedAt`: evita exponer la fecha exacta y simplifica el consumo
 * en el cliente (solo necesita comprobar el booleano).
 *
 * El campo `anthropicApiKey` NUNCA se incluye en este tipo para evitar que
 * la API key del usuario sea accesible por GraphQL.
 */
export const userTypeDefs = `#graphql
  """
  Usuario registrado en ScrumForge.
  Solo expone campos públicos del perfil — las credenciales y tokens internos
  no forman parte de este tipo.
  """
  type User {
    id: ID!
    "Dirección de correo electrónico única del usuario."
    email: String!
    "Nombre visible del usuario en la interfaz."
    name: String!
    "URL del avatar del usuario; null si no ha subido ninguno."
    avatarUrl: String
    "Indica si el usuario ha verificado su correo electrónico. Derivado de emailVerifiedAt."
    emailVerified: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  "Tipo raíz Query. Los demás módulos añaden sus queries con 'extend type Query'."
  type Query {
    "Devuelve el perfil del usuario autenticado, o null si no hay sesión activa."
    me: User
    "Exporta todos los datos del usuario como JSON (derecho de portabilidad RGPD)."
    exportMyData: String!
    "Indica si el usuario tiene una API key de Anthropic guardada (sin exponer la key)."
    hasAnthropicApiKey: Boolean!
  }

  extend type Mutation {
    "Actualiza el nombre y/o la URL del avatar del usuario autenticado."
    updateProfile(name: String, avatarUrl: String): User!
    "Elimina permanentemente la cuenta. Requiere confirmar la contraseña actual."
    deleteAccount(password: String!): Boolean!
    "Guarda la API key personal de Anthropic para las features de IA."
    saveAnthropicApiKey(key: String!): Boolean!
    "Elimina la API key personal de Anthropic. Las features de IA usarán la clave global."
    deleteAnthropicApiKey: Boolean!
  }
`;
