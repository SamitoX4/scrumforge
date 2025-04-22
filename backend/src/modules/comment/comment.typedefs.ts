/**
 * @file comment.typedefs.ts
 * @module comment
 * @description Definición del esquema GraphQL para el módulo de comentarios.
 *
 * Define el tipo `Comment` con sus campos, el input `AddCommentInput`
 * para la creación, y extiende los tipos `Query` y `Mutation` del esquema
 * principal con las operaciones disponibles.
 *
 * Los comentarios son polimórficos: pueden pertenecer a una historia
 * (`userStoryId`) o a una tarea (`taskId`), siendo ambos campos opcionales
 * en el esquema pero mutuamente excluyentes en la lógica del servicio.
 */
export const commentTypeDefs = `#graphql
  """
  Representa un comentario de texto asociado a una historia de usuario o tarea.
  """
  type Comment {
    id: ID!
    """ Contenido del comentario. """
    body: String!
    """ ID del usuario que escribió el comentario. """
    authorId: String!
    """ ID de la historia de usuario asociada (puede ser nulo si es de una tarea). """
    userStoryId: String
    """ ID de la tarea asociada (puede ser nulo si es de una historia). """
    taskId: String
    createdAt: DateTime!
    updatedAt: DateTime!
    """ Datos del autor resueltos mediante relación. """
    author: User!
  }

  """
  Input para crear un nuevo comentario.
  Al menos uno de userStoryId o taskId debe estar presente.
  """
  input AddCommentInput {
    body: String!
    userStoryId: ID
    taskId: ID
  }

  extend type Query {
    """ Retorna los comentarios de una historia o tarea específica. """
    comments(userStoryId: ID, taskId: ID): [Comment!]!
  }

  extend type Mutation {
    """ Crea un nuevo comentario. El autor se infiere del usuario autenticado. """
    addComment(input: AddCommentInput!): Comment!
    """ Elimina un comentario. Solo lo puede realizar el propio autor. """
    deleteComment(id: ID!): Boolean!
  }
`;
