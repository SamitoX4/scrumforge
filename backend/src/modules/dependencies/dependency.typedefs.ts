/**
 * @file dependency.typedefs.ts
 * @module dependencies
 * @description Definición del esquema GraphQL para las dependencias entre historias.
 *
 * Una `StoryDependency` modela la relación dirigida entre dos historias de usuario:
 * `fromStory` es la historia que depende de `toStory`. El campo `type` indica
 * la naturaleza de la dependencia (p.ej. "BLOCKS", "DEPENDS_ON", "RELATED_TO").
 *
 * Los campos `fromStory` y `toStory` son opcionales en el esquema porque
 * se resuelven como relaciones y pueden ser null si la historia fue eliminada.
 */
export const dependencyTypeDefs = `#graphql
  """
  Dependencia dirigida entre dos historias de usuario.
  Indica que 'fromStory' tiene alguna relación de bloqueo o prerrequisito con 'toStory'.
  """
  type StoryDependency {
    id:          ID!
    """ ID de la historia que tiene la dependencia. """
    fromStoryId: String!
    """ ID de la historia de la que se depende. """
    toStoryId:   String!
    """ Tipo de relación entre las historias (p.ej. BLOCKS, DEPENDS_ON). """
    type:        String!
    createdAt:   String!
    """ Historia origen, resuelta como relación. """
    fromStory:   UserStory
    """ Historia destino, resuelta como relación. """
    toStory:     UserStory
  }

  extend type Query {
    """ Retorna todas las dependencias en las que participa una historia. """
    storyDependencies(storyId: ID!): [StoryDependency!]!
  }

  extend type Mutation {
    """ Crea una nueva dependencia entre dos historias de usuario. """
    addDependency(fromStoryId: ID!, toStoryId: ID!, type: String!): StoryDependency!
    """ Elimina una dependencia por su ID. """
    removeDependency(id: ID!): Boolean!
  }
`;
