/**
 * @file dependency.resolver.ts
 * @module dependencies
 * @description Resolvers de GraphQL para el módulo de dependencias entre historias.
 *
 * Las dependencias expresan relaciones de bloqueo o prerrequisito entre
 * historias de usuario (p.ej. "la historia A depende de la historia B").
 * El módulo incluye resolvers de campo para cargar las historias relacionadas
 * desde la base de datos.
 */

import { GraphQLContext } from '../../graphql/context';
import { DependencyService } from './dependency.service';
import { requireAuth } from '../../middleware/auth.middleware';

/**
 * Instancia el servicio de dependencias con el cliente Prisma del contexto.
 *
 * @param ctx - Contexto GraphQL de la petición.
 * @returns Nueva instancia de DependencyService.
 */
function makeService(ctx: GraphQLContext) {
  return new DependencyService(ctx.prisma);
}

/**
 * Mapa de resolvers para el módulo de dependencias.
 * Incluye Query, Mutation y resolvers de campo del tipo `StoryDependency`.
 */
export const dependencyResolvers = {
  Query: {
    /**
     * Retorna todas las dependencias en las que participa una historia de usuario,
     * ya sea como origen (`fromStory`) o como destino (`toStory`).
     *
     * @param _ - Parent resolver; no utilizado.
     * @param storyId - ID de la historia de usuario a consultar.
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns Lista de dependencias asociadas a la historia.
     */
    async storyDependencies(_: unknown, { storyId }: { storyId: string }, ctx: GraphQLContext) {
      requireAuth(ctx);
      return makeService(ctx).getForStory(storyId);
    },
  },
  Mutation: {
    /**
     * Registra una nueva dependencia entre dos historias de usuario.
     * El usuario que crea la dependencia se registra para auditoría.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param fromStoryId - Historia que tiene la dependencia (la que depende).
     * @param toStoryId - Historia de la que se depende (bloqueante).
     * @param type - Tipo de dependencia (p.ej. "BLOCKS", "DEPENDS_ON").
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns La dependencia recién creada.
     */
    async addDependency(
      _: unknown,
      { fromStoryId, toStoryId, type }: { fromStoryId: string; toStoryId: string; type: string },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx);
      // El ID del usuario autenticado se pasa para posible trazabilidad
      return makeService(ctx).add(fromStoryId, toStoryId, type, ctx.user.id);
    },

    /**
     * Elimina una dependencia por su ID.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param id - ID de la dependencia a eliminar.
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns `true` si la eliminación fue exitosa.
     */
    async removeDependency(_: unknown, { id }: { id: string }, ctx: GraphQLContext) {
      requireAuth(ctx);
      return makeService(ctx).remove(id);
    },
  },

  /**
   * Resolvers de campo del tipo `StoryDependency`.
   * Cargan las historias relacionadas desde la BD usando los IDs del objeto padre.
   */
  StoryDependency: {
    /**
     * Resuelve la historia de usuario que origina la dependencia.
     *
     * @param parent - Objeto StoryDependency con `fromStoryId`.
     * @param _ - Argumentos del campo; no utilizados.
     * @param prisma - Cliente Prisma del contexto.
     * @returns La historia de usuario origen.
     */
    fromStory: (parent: { fromStoryId: string }, _: unknown, { prisma }: GraphQLContext) =>
      prisma.userStory.findUnique({ where: { id: parent.fromStoryId } }),

    /**
     * Resuelve la historia de usuario que es destino de la dependencia
     * (la historia bloqueante o prerrequisito).
     *
     * @param parent - Objeto StoryDependency con `toStoryId`.
     * @param _ - Argumentos del campo; no utilizados.
     * @param prisma - Cliente Prisma del contexto.
     * @returns La historia de usuario destino.
     */
    toStory: (parent: { toStoryId: string }, _: unknown, { prisma }: GraphQLContext) =>
      prisma.userStory.findUnique({ where: { id: parent.toStoryId } }),
  },
};
