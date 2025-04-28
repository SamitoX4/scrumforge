/**
 * @fileoverview Operaciones GraphQL del módulo de comentarios.
 *
 * Agrupa queries y mutaciones para gestionar comentarios en historias de
 * usuario y tareas. Un mismo archivo concentra todas las operaciones del
 * módulo porque son pocas y están estrechamente relacionadas, evitando
 * la dispersión en múltiples archivos.
 *
 * Los comentarios pueden pertenecer a una historia de usuario (`userStoryId`)
 * o a una tarea (`taskId`), pero nunca a ambos simultáneamente.
 */

import { gql } from '@apollo/client';

/**
 * Obtiene los comentarios asociados a una historia de usuario o una tarea.
 *
 * Los parámetros son opcionales de forma individual pero al menos uno debe
 * proporcionarse. El servidor filtra por el que esté presente. Retorna los
 * datos del autor embebidos para evitar una segunda consulta al mostrar
 * el avatar y nombre en la lista de comentarios.
 *
 * @param $userStoryId {ID?} - ID de la historia de usuario cuyos comentarios
 *   se quieren obtener.
 * @param $taskId {ID?} - ID de la tarea cuyos comentarios se quieren obtener.
 * @returns Lista de comentarios con id, cuerpo, autor embebido y fechas.
 */
export const GET_COMMENTS = gql`
  query GetComments($userStoryId: ID, $taskId: ID) {
    comments(userStoryId: $userStoryId, taskId: $taskId) {
      id body authorId createdAt
      author { id name avatarUrl }
    }
  }
`;

/**
 * Añade un nuevo comentario a una historia de usuario o tarea.
 *
 * El servidor determina el tipo de entidad destino (historia o tarea)
 * a partir de los campos incluidos en `AddCommentInput`. Se devuelven
 * los mismos campos que en `GET_COMMENTS` para que Apollo Client pueda
 * actualizar la caché local sin recargar la lista completa.
 *
 * @param $input {AddCommentInput} - Datos del comentario: cuerpo del texto,
 *   y el ID de la historia de usuario o tarea destino.
 * @returns Comentario creado con autor embebido, listo para insertar en caché.
 */
export const ADD_COMMENT = gql`
  mutation AddComment($input: AddCommentInput!) {
    addComment(input: $input) {
      id body authorId createdAt
      author { id name avatarUrl }
    }
  }
`;

/**
 * Elimina un comentario por su identificador.
 *
 * Solo el autor del comentario o un administrador del workspace puede
 * eliminarlo (autorización gestionada en el servidor). La respuesta es
 * un booleano simple porque el cliente solo necesita confirmar el éxito
 * para eliminar el elemento de la caché local.
 *
 * @param $id {ID} - Identificador del comentario a eliminar.
 * @returns Boolean indicando si la eliminación fue exitosa.
 */
export const DELETE_COMMENT = gql`
  mutation DeleteComment($id: ID!) {
    deleteComment(id: $id)
  }
`;
