/**
 * @file workspace.typedefs.ts
 * @description Definiciones del esquema GraphQL para el módulo de workspaces.
 *
 * Un workspace es el contenedor de nivel más alto en ScrumForge: agrupa equipos,
 * proyectos y suscripciones de plan. Los tipos `Query` y `Mutation` raíz se
 * extienden aquí porque se definen originalmente en `user.typedefs.ts`.
 *
 * El campo `planLimits` devuelve un escalar `JSON` con la configuración del plan
 * activo. Se usa JSON en lugar de un tipo tipado porque los campos de plan pueden
 * variar entre versiones sin requerir cambios de esquema.
 */
export const workspaceTypeDefs = `#graphql
  """
  Espacio de trabajo principal de ScrumForge.
  Agrupa equipos, proyectos y tiene un plan de suscripción asociado.
  """
  type Workspace {
    id: ID!
    "Nombre visible del workspace."
    name: String!
    "Identificador URL-friendly único, p. ej. 'mi-empresa'."
    slug: String!
    "ID del usuario propietario del workspace."
    ownerId: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    "Lista de equipos que pertenecen al workspace."
    teams: [Team!]!
    """
    Límites y flags de features del plan activo del workspace.
    Ejemplo: { planningPoker: true, advancedReports: false, maxProjects: null }
    null en un campo numérico = ilimitado.
    """
    planLimits: JSON!
  }

  "Datos requeridos para crear un nuevo workspace."
  input CreateWorkspaceInput {
    name: String!
    "Slug único URL-friendly. Solo puede usarse una vez en todo el sistema."
    slug: String!
  }

  "Datos modificables de un workspace existente."
  input UpdateWorkspaceInput {
    name: String!
  }

  extend type Query {
    "Devuelve todos los workspaces accesibles para el usuario autenticado."
    workspaces: [Workspace!]!
    "Devuelve un workspace por su ID."
    workspace(id: ID!): Workspace
    "Devuelve un workspace por su slug URL-friendly."
    workspaceBySlug(slug: String!): Workspace
  }

  extend type Mutation {
    "Crea un nuevo workspace con el usuario autenticado como propietario."
    createWorkspace(input: CreateWorkspaceInput!): Workspace!
    "Actualiza el nombre del workspace. Solo el propietario puede ejecutar esta acción."
    updateWorkspace(id: ID!, input: UpdateWorkspaceInput!): Workspace!
    "Elimina el workspace y todos sus datos en cascada. Solo el propietario puede ejecutar esta acción."
    deleteWorkspace(id: ID!): Boolean!
  }
`;
