/**
 * Definiciones de tipos GraphQL para el módulo de Tablero (Board).
 *
 * Define las estructuras de datos del tablero Kanban: las columnas y su input
 * de actualización, así como las extensiones del schema raíz para query,
 * mutation y subscription relacionadas con el tablero.
 */
export const boardTypeDefs = `#graphql
  """
  Columna del tablero Kanban con sus propiedades de configuración.
  Cada columna mapea a un valor del enum StoryStatus para que las historias
  puedan moverse entre columnas cambiando su estado.
  """
  type BoardColumn {
    """ Identificador estable de la columna (se usa para drag & drop) """
    id: ID!
    """ Título visible de la columna (ej. "Por hacer", "En progreso") """
    title: String!
    """ Valor del enum StoryStatus al que mapea esta columna """
    status: String!
    """ Color hexadecimal de la cabecera de la columna (opcional) """
    color: String
    """ Posición de la columna en el tablero (0 = primera) """
    order: Int!
    """ Límite de trabajo en progreso (WIP); null significa sin límite """
    wipLimit: Int
  }

  """
  Input para actualizar la configuración de columnas del tablero.
  Idéntico a BoardColumn pero como input porque GraphQL requiere tipos distintos
  para lectura y escritura.
  """
  input BoardColumnInput {
    id: ID!
    title: String!
    status: String!
    color: String
    order: Int!
    wipLimit: Int
  }

  extend type Query {
    """
    Devuelve la configuración de columnas del tablero de un proyecto.
    Si el proyecto no tiene columnas personalizadas, retorna las columnas por defecto.
    """
    boardColumns(projectId: ID!): [BoardColumn!]!
  }

  extend type Mutation {
    """
    Actualiza la configuración de columnas del tablero.
    Solo Product Owners y Scrum Masters pueden usar esta mutación.
    """
    updateBoardColumns(projectId: ID!, columns: [BoardColumnInput!]!): [BoardColumn!]!
  }

  extend type Subscription {
    """ Emite la historia actualizada cuando su estado cambia en el tablero. """
    boardUpdated(projectId: ID!): UserStory!
  }
`;
