/**
 * Definiciones de tipos GraphQL para el módulo de Sprints.
 *
 * Define el tipo Sprint y sus relacionados (SprintStats, SprintStatus),
 * así como los inputs para las mutaciones y las extensiones del schema
 * raíz (Query y Mutation).
 */
export const sprintTypeDefs = `#graphql
  """
  Iteración de tiempo fijo (sprint) de un proyecto Scrum.
  Contiene las historias de usuario que el equipo se compromete a completar.
  """
  type Sprint {
    id: ID!
    name: String!
    """ Meta del sprint: qué valor aportará al producto al finalizar """
    goal: String
    projectId: String!
    startDate: DateTime
    endDate: DateTime
    """ Estado actual del sprint dentro de su ciclo de vida """
    status: SprintStatus!
    createdAt: DateTime!
    updatedAt: DateTime!
    """ Historias de usuario asignadas a este sprint, ordenadas por prioridad """
    userStories: [UserStory!]!
    """ Métricas calculadas en tiempo real: puntos, progreso, etc. """
    stats: SprintStats!
  }

  """
  Métricas de progreso de un sprint calculadas a partir de sus historias.
  Se usan en la pantalla de detalle y en el burndown chart.
  """
  type SprintStats {
    """ Suma de puntos de historia de todas las historias del sprint """
    totalPoints: Int!
    """ Suma de puntos de las historias con status DONE """
    completedPoints: Int!
    """ Número total de historias en el sprint """
    totalStories: Int!
    """ Número de historias completadas """
    completedStories: Int!
    """ Porcentaje de avance (0-100) basado en cantidad de historias """
    progressPercent: Int!
  }

  """
  Estados posibles de un sprint durante su ciclo de vida.
  El flujo es siempre PLANNING → ACTIVE → COMPLETED; no hay retrocesos.
  """
  enum SprintStatus {
    """ Sprint planificado pero no iniciado aún """
    PLANNING
    """ Sprint en curso; solo puede haber uno activo por proyecto """
    ACTIVE
    """ Sprint cerrado; sus datos quedan para reportes históricos """
    COMPLETED
  }

  """ Datos necesarios para crear un sprint en estado PLANNING """
  input CreateSprintInput {
    name: String!
    goal: String
    projectId: ID!
    """ Fecha tentativa de inicio (puede redefinirse al iniciar el sprint) """
    startDate: DateTime
    """ Fecha tentativa de fin """
    endDate: DateTime
  }

  """ Datos requeridos para iniciar un sprint (transición PLANNING → ACTIVE) """
  input StartSprintInput {
    goal: String
    """ Fecha de inicio definitiva del sprint """
    startDate: DateTime!
    """ Fecha de fin comprometida del sprint """
    endDate: DateTime!
  }

  extend type Query {
    """ Devuelve todos los sprints de un proyecto, del más reciente al más antiguo """
    sprints(projectId: ID!): [Sprint!]!
    """ Obtiene un sprint por su ID """
    sprint(id: ID!): Sprint
    """ Devuelve el sprint activo del proyecto, o null si no hay ninguno """
    activeSprint(projectId: ID!): Sprint
  }

  extend type Mutation {
    """ Crea un nuevo sprint en estado PLANNING. Requiere rol PRODUCT_OWNER o SCRUM_MASTER """
    createSprint(input: CreateSprintInput!): Sprint!
    """ Inicia un sprint (PLANNING → ACTIVE). Falla si ya hay otro sprint activo """
    startSprint(id: ID!, input: StartSprintInput!): Sprint!
    """
    Cierra un sprint activo (ACTIVE → COMPLETED).
    Las historias incompletas se mueven al sprint indicado o al backlog.
    """
    completeSprint(id: ID!, moveIncompleteToSprintId: ID): Sprint!
    """ Elimina un sprint en PLANNING o COMPLETED. Devuelve las historias al backlog """
    deleteSprint(id: ID!): Boolean!
  }
`;
