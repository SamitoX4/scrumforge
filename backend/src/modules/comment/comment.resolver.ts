/**
 * @file comment.resolver.ts
 * @module comment
 * @description Resolvers de GraphQL para el módulo de comentarios.
 *
 * Gestiona las operaciones de consulta, creación y eliminación de comentarios
 * en historias de usuario y tareas. También incluye el resolver de campo
 * `author` para cargar el usuario autor desde la base de datos.
 *
 * Todos los resolvers requieren autenticación.
 */

import { GraphQLContext } from '../../graphql/context';
import { CommentService } from './comment.service';
import { CommentRepository } from './comment.repository';
import { requireAuth } from '../../middleware/auth.middleware';

/**
 * Construye el árbol de dependencias del módulo de comentarios:
 * repositorio → servicio. Se instancia por request para que cada
 * operación use su propio contexto de Prisma.
 *
 * @param context - Contexto GraphQL de la petición.
 * @returns Instancia de CommentService lista para usar.
 */
function makeService(context: GraphQLContext) {
  return new CommentService(new CommentRepository(context.prisma));
}

/**
 * Mapa de resolvers para el módulo de comentarios.
 * Incluye Query, Mutation y el resolver de campo `author` del tipo `Comment`.
 */
export const commentResolvers = {
  Query: {
    /**
     * Retorna los comentarios de una historia de usuario o tarea.
     * Se requiere al menos uno de `userStoryId` o `taskId`;
     * si ninguno se provee, el servicio retorna una lista vacía.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param userStoryId - ID de la historia (opcional).
     * @param taskId - ID de la tarea (opcional).
     * @param context - Contexto GraphQL con usuario autenticado.
     * @returns Lista de comentarios encontrados.
     */
    async comments(
      _: unknown,
      { userStoryId, taskId }: { userStoryId?: string; taskId?: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).getComments({ userStoryId, taskId });
    },
  },

  Mutation: {
    /**
     * Agrega un nuevo comentario a una historia o tarea.
     * El ID del autor se extrae del token de sesión (`context.user.id`)
     * para evitar que el cliente pueda falsificar la autoría.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param input - Datos del comentario (cuerpo y referencia a entidad).
     * @param context - Contexto GraphQL con usuario autenticado.
     * @returns El comentario creado.
     */
    async addComment(
      _: unknown,
      { input }: { input: { body: string; userStoryId?: string; taskId?: string } },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      // El userId se toma del contexto autenticado, no del input del cliente
      return makeService(context).addComment(context.user.id, input);
    },

    /**
     * Elimina un comentario existente.
     * Solo el autor original puede eliminar su propio comentario
     * (validado en el servicio comparando `authorId` con el usuario en sesión).
     *
     * @param _ - Parent resolver; no utilizado.
     * @param id - ID del comentario a eliminar.
     * @param context - Contexto GraphQL con usuario autenticado.
     * @returns `true` si la eliminación fue exitosa.
     */
    async deleteComment(_: unknown, { id }: { id: string }, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).deleteComment(context.user.id, id);
    },
  },

  /**
   * Resolvers de campo del tipo `Comment`.
   * GraphQL llama a estos métodos cuando un query solicita
   * campos que no están directamente en el objeto Comment de Prisma.
   */
  Comment: {
    /**
     * Resuelve el campo `author` cargando el usuario desde la base de datos.
     * Usa `authorId` del objeto padre para realizar la búsqueda.
     * Este resolver se ejecuta por cada comentario retornado, por lo que
     * en producción podría beneficiarse de un DataLoader para evitar N+1.
     *
     * @param parent - Objeto Comment con `authorId`.
     * @param _ - Argumentos del campo; no utilizados.
     * @param prisma - Cliente Prisma del contexto.
     * @returns El usuario autor del comentario.
     */
    async author(parent: { authorId: string }, _: unknown, { prisma }: GraphQLContext) {
      return prisma.user.findUnique({ where: { id: parent.authorId } });
    },
  },
};
