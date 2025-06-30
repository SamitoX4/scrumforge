/**
 * @file dod.resolver.ts
 * @module definition-of-done
 * @description Resolvers de GraphQL para el módulo de Definition of Done (DoD).
 *
 * El DoD es una lista de criterios de calidad que debe cumplir una historia
 * de usuario para considerarse completada. Este módulo permite gestionar
 * esos ítems y reordenarlos dentro de un proyecto.
 *
 * Las operaciones de escritura (crear y reordenar) requieren además el
 * permiso `backlog:write` sobre el proyecto, verificado mediante RBAC.
 */

import { GraphQLContext } from '../../graphql/context';
import { DodService } from './dod.service';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

/**
 * Instancia el servicio de DoD con el cliente Prisma del contexto actual.
 * Se crea por cada resolver para garantizar aislamiento de contexto.
 *
 * @param ctx - Contexto GraphQL de la petición.
 * @returns Nueva instancia de DodService.
 */
function makeService(ctx: GraphQLContext) {
  return new DodService(ctx.prisma);
}

/**
 * Mapa de resolvers para el módulo de Definition of Done.
 */
export const dodResolvers = {
  Query: {
    /**
     * Retorna todos los ítems del DoD de un proyecto, ordenados
     * por el campo `order` ascendente.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param projectId - ID del proyecto.
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns Lista de ítems DoD ordenados.
     */
    async dodItems(_: unknown, { projectId }: { projectId: string }, ctx: GraphQLContext) {
      requireAuth(ctx);
      return makeService(ctx).getItems(projectId);
    },
  },
  Mutation: {
    /**
     * Crea un nuevo ítem en la lista de DoD del proyecto.
     * El ítem se inserta al final de la lista asignando el siguiente
     * número de orden disponible. Requiere permiso `backlog:write`.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param projectId - ID del proyecto donde se crea el ítem.
     * @param text - Texto descriptivo del criterio de completitud.
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns El ítem DoD recién creado.
     */
    async createDodItem(_: unknown, { projectId, text }: { projectId: string; text: string }, ctx: GraphQLContext) {
      requireAuth(ctx);
      // Se verifica que el usuario tenga permiso de escritura en el backlog del proyecto
      await requirePermission(ctx, projectId, 'backlog:write');
      return makeService(ctx).create(projectId, text);
    },

    /**
     * Actualiza el texto de un ítem DoD existente.
     * No requiere permiso RBAC adicional más allá de la autenticación,
     * ya que la verificación de proyecto se realiza en el servicio.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param id - ID del ítem a actualizar.
     * @param text - Nuevo texto del criterio (opcional).
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns El ítem DoD actualizado.
     */
    async updateDodItem(_: unknown, { id, text }: { id: string; text?: string }, ctx: GraphQLContext) {
      requireAuth(ctx);
      return makeService(ctx).update(id, text);
    },

    /**
     * Elimina un ítem DoD por su ID.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param id - ID del ítem a eliminar.
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns `true` si la eliminación fue exitosa.
     */
    async deleteDodItem(_: unknown, { id }: { id: string }, ctx: GraphQLContext) {
      requireAuth(ctx);
      return makeService(ctx).delete(id);
    },

    /**
     * Reordena los ítems DoD de un proyecto según el array de IDs proporcionado.
     * La posición de cada ID en el array determina su nuevo valor `order`.
     * Requiere permiso `backlog:write`.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param projectId - ID del proyecto.
     * @param orderedIds - Array de IDs en el nuevo orden deseado.
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns Lista completa de ítems DoD con el nuevo orden aplicado.
     */
    async reorderDodItems(_: unknown, { projectId, orderedIds }: { projectId: string; orderedIds: string[] }, ctx: GraphQLContext) {
      requireAuth(ctx);
      await requirePermission(ctx, projectId, 'backlog:write');
      return makeService(ctx).reorder(projectId, orderedIds);
    },
  },
};
