/**
 * @file epic.typedefs.ts
 * @module epic
 * @description Definición del esquema GraphQL para el módulo de épicas.
 *
 * Una épica es una unidad de trabajo de alto nivel que agrupa varias
 * historias de usuario relacionadas. Tiene prioridad, color visual
 * y un orden configurable dentro del proyecto.
 *
 * Define:
 * - Tipo `Epic` con sus campos y la relación a `UserStory`.
 * - Enum `Priority` con los niveles de prioridad disponibles.
 * - Inputs `CreateEpicInput` y `UpdateEpicInput`.
 * - Extensiones de `Query` y `Mutation` para operaciones CRUD y reordenamiento.
 *
 * El argumento `targetEpicId` en `deleteEpic` permite migrar las historias
 * de la épica eliminada a otra épica existente antes de borrarla.
 */
export const epicTypeDefs = `#graphql
  """
  Épica que agrupa historias de usuario relacionadas bajo un objetivo común.
  """
  type Epic {
    id: ID!
    title: String!
    description: String
    projectId: String!
    """ Nivel de prioridad de la épica. """
    priority: Priority!
    """ Color hexadecimal para identificación visual en el tablero. """
    color: String!
    """ Posición de la épica en la lista del proyecto (0-indexed). """
    order: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
    """ Historias de usuario pertenecientes a esta épica. """
    userStories: [UserStory!]!
  }

  """
  Niveles de prioridad disponibles para épicas e historias de usuario.
  Ordenados de mayor a menor urgencia.
  """
  enum Priority {
    CRITICAL
    HIGH
    MEDIUM
    LOW
  }

  """
  Input para crear una nueva épica. El color y la prioridad son opcionales
  con valores por defecto aplicados en el servicio.
  """
  input CreateEpicInput {
    title: String!
    description: String
    projectId: ID!
    priority: Priority
    color: String
  }

  """
  Input para actualizar una épica existente. Todos los campos son opcionales
  para permitir actualizaciones parciales.
  """
  input UpdateEpicInput {
    title: String
    description: String
    priority: Priority
    color: String
    """ Nuevo valor de orden si se reposiciona manualmente. """
    order: Int
  }

  extend type Query {
    """ Retorna todas las épicas de un proyecto ordenadas por posición. """
    epics(projectId: ID!): [Epic!]!
    """ Retorna una épica concreta por su ID. """
    epic(id: ID!): Epic
  }

  extend type Mutation {
    """ Crea una nueva épica en el proyecto. """
    createEpic(input: CreateEpicInput!): Epic!
    """ Actualiza los campos de una épica existente. """
    updateEpic(id: ID!, input: UpdateEpicInput!): Epic!
    """
    Elimina una épica. Si se provee targetEpicId, sus historias
    son migradas a esa épica antes de la eliminación.
    """
    deleteEpic(id: ID!, targetEpicId: ID): Boolean!
    """ Reordena las épicas del proyecto según el array de IDs. """
    reorderEpics(projectId: ID!, orderedIds: [ID!]!): [Epic!]!
  }
`;
