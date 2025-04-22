/**
 * Definiciones de tipos GraphQL para el módulo de Historias de Usuario.
 *
 * Define el tipo UserStory y sus relacionados (StoryStatus, Priority),
 * los inputs de creación y actualización, y las extensiones del schema
 * raíz para queries y mutaciones del backlog.
 */
export const userStoryTypeDefs = `#graphql
  """
  Historia de usuario que representa un requisito funcional del producto.
  Puede estar en el backlog (sin sprint) o asignada a un sprint activo.
  """
  type UserStory {
    id: ID!
    title: String!
    """ Descripción detallada en formato libre (markdown soportado en el frontend) """
    description: String
    """ ID de la épica a la que pertenece esta historia (opcional) """
    epicId: String
    projectId: String!
    """ Sprint al que está asignada; null si está en el product backlog """
    sprintId: String
    """ Estado actual dentro del flujo de trabajo del tablero Kanban """
    status: StoryStatus!
    """ Estimación en puntos de historia (escala Fibonacci recomendada) """
    points: Int
    priority: Priority!
    """ ID del desarrollador asignado para implementar esta historia """
    assigneeId: String
    """ Posición en el backlog o sprint backlog (0 = primera) """
    order: Int!
    """ Indica si la historia está bloqueada por un impedimento """
    isBlocked: Boolean!
    """ Descripción del motivo de bloqueo (solo presente si isBlocked = true) """
    blockedReason: String
    """ Campos personalizados definidos por el equipo (estructura libre en JSON) """
    customFields: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
    """ Épica a la que pertenece esta historia (resolver de campo) """
    epic: Epic
    """ Sprint al que está asignada (resolver de campo) """
    sprint: Sprint
    """ Usuario asignado para implementar esta historia (resolver de campo) """
    assignee: User
    """ Tareas técnicas de la historia, ordenadas por el campo order """
    tasks: [Task!]!
  }

  """
  Estados posibles de una historia de usuario en el tablero Kanban.
  Cada estado corresponde a una columna del tablero.
  """
  enum StoryStatus {
    """ Historia pendiente de iniciar """
    TODO
    """ Historia en desarrollo activo """
    IN_PROGRESS
    """ Historia completada y en revisión de código o QA """
    IN_REVIEW
    """ Historia completada y validada por el PO """
    DONE
  }

  """ Datos necesarios para crear una nueva historia de usuario en el backlog """
  input CreateUserStoryInput {
    title: String!
    description: String
    projectId: ID!
    """ Épica a la que pertenece (opcional) """
    epicId: ID
    """ Prioridad inicial; por defecto MEDIUM si no se especifica """
    priority: Priority
    """ Estimación inicial en puntos (puede definirse más tarde en Planning Poker) """
    points: Int
    """ Desarrollador al que se asigna desde el inicio (opcional) """
    assigneeId: ID
  }

  """ Datos para actualizar una historia de usuario (todos los campos son opcionales) """
  input UpdateUserStoryInput {
    title: String
    description: String
    """ Cambiar o quitar la épica (null = sin épica) """
    epicId: ID
    """ Mover a un sprint o devolver al backlog (null = backlog) """
    sprintId: ID
    status: StoryStatus
    priority: Priority
    points: Int
    """ Cambiar el asignado o quitar la asignación (null = sin asignado) """
    assigneeId: ID
    order: Int
    """ Actualización parcial de campos personalizados (se hace merge con los existentes) """
    customFields: JSON
  }

  extend type Query {
    """ Historias de usuario con filtros opcionales de sprint y épica """
    userStories(projectId: ID!, sprintId: ID, epicId: ID): [UserStory!]!
    """ Obtiene una historia de usuario por su ID """
    userStory(id: ID!): UserStory
    """ Historias del product backlog (sin sprint asignado), ordenadas por prioridad """
    backlog(projectId: ID!): [UserStory!]!
  }

  extend type Mutation {
    """ Crea una nueva historia de usuario en el backlog. Requiere permiso backlog:write """
    createUserStory(input: CreateUserStoryInput!): UserStory!
    """ Actualiza campos de una historia de usuario. Requiere permiso board:move """
    updateUserStory(id: ID!, input: UpdateUserStoryInput!): UserStory!
    """ Elimina una historia de usuario. Requiere rol PRODUCT_OWNER o SCRUM_MASTER """
    deleteUserStory(id: ID!): Boolean!
    """ Mueve una historia a un sprint o la devuelve al backlog (sprintId = null) """
    moveToSprint(storyId: ID!, sprintId: ID): UserStory!
    """ Marca una historia como bloqueada y notifica a los Scrum Masters """
    blockStory(id: ID!, reason: String!): UserStory!
    """ Elimina el bloqueo de una historia y registra un comentario de resolución """
    unblockStory(id: ID!, comment: String!): UserStory!
    """ Reordena el backlog moviendo una historia a una nueva posición """
    reorderBacklog(projectId: ID!, storyId: ID!, newPosition: Int!, targetEpicId: ID): [UserStory!]!
    """ Importa historias desde un CSV. Requiere autenticación (@auth) """
    importStoriesCsv(projectId: ID!, csv: String!): ImportResult! @auth
  }

  """
  Resultado de una importación de historias desde CSV.
  Devuelve contadores y los mensajes de error por fila para que el
  cliente pueda mostrar un resumen de la operación al usuario.
  """
  type ImportResult {
    """ Número de historias importadas exitosamente """
    imported: Int!
    """ Número de filas omitidas por errores de validación """
    skipped: Int!
    """ Mensajes de error por fila (puede estar vacío si todo fue bien) """
    errors: [String!]!
  }
`;
