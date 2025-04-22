/**
 * @file epic.resolver.ts
 * @description Resolvers GraphQL del módulo de épicas.
 *
 * Cada resolver construye su propio `EpicService` a través de `makeService`
 * para garantizar aislamiento por petición. Todos los resolvers exigen
 * autenticación mediante `requireAuth`.
 *
 * Las mutaciones de escritura (`createEpic`, `updateEpic`, `deleteEpic`) verifican
 * además el permiso RBAC `backlog:write` sobre el proyecto concreto, por lo que el
 * control de acceso opera en dos niveles: autenticación + autorización por recurso.
 *
 * El campo `Epic.userStories` se resuelve de forma perezosa para no penalizar
 * las queries que solo necesiten datos básicos de la épica.
 */
import { GraphQLContext } from '../../graphql/context';
import { EpicService } from './epic.service';
import { EpicRepository } from './epic.repository';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

/**
 * Factoría que construye un `EpicService` listo para usar con el contexto
 * de la petición actual. Combina repositorio y cliente Prisma en una sola llamada.
 *
 * @param context - Contexto GraphQL de Apollo con el cliente Prisma y el usuario autenticado.
 * @returns Instancia de `EpicService` configurada para esta petición.
 */
function makeService(context: GraphQLContext) {
  return new EpicService(new EpicRepository(context.prisma), context.prisma);
}

export const epicResolvers = {
  Query: {
    /**
     * Devuelve todas las épicas de un proyecto, ordenadas por su campo `order`.
     *
     * @param _ - Objeto padre (no aplica en queries raíz).
     * @param projectId - ID del proyecto cuyas épicas se quieren listar.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async epics(_: unknown, { projectId }: { projectId: string }, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).getEpics(projectId);
    },

    /**
     * Devuelve una épica por su ID.
     *
     * @param _ - Objeto padre (no aplica en queries raíz).
     * @param id - ID de la épica.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async epic(_: unknown, { id }: { id: string }, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).getEpic(id);
    },
  },

  Mutation: {
    /**
     * Crea una nueva épica en el proyecto indicado.
     * Requiere autenticación y permiso `backlog:write` sobre el proyecto.
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param input - Datos de la nueva épica.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async createEpic(
      _: unknown,
      { input }: { input: { title: string; description?: string; projectId: string; priority?: string; color?: string } },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      // Verificar permiso RBAC específico del proyecto antes de crear
      await requirePermission(context, input.projectId, 'backlog:write');
      return makeService(context).createEpic(context.user.id, input);
    },

    /**
     * Actualiza los datos de una épica existente.
     * Requiere autenticación y permiso `backlog:write` sobre el proyecto de la épica.
     * El `projectId` se obtiene de la BD para no depender del cliente.
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param id - ID de la épica a actualizar.
     * @param input - Campos a modificar.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async updateEpic(
      _: unknown,
      { id, input }: { id: string; input: { title?: string; description?: string; priority?: string; color?: string; order?: number } },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      // Obtener el projectId de la BD para verificar el permiso del recurso correcto
      const epic = await context.prisma.epic.findUnique({ where: { id }, select: { projectId: true } });
      if (epic) await requirePermission(context, epic.projectId, 'backlog:write');
      return makeService(context).updateEpic(context.user.id, id, input);
    },

    /**
     * Elimina una épica. Si se proporciona `targetEpicId`, las historias de usuario
     * de la épica eliminada se reasignan a la épica destino antes de borrar.
     * Sin `targetEpicId`, las historias quedan sin épica (`epicId = null`).
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param id - ID de la épica a eliminar.
     * @param targetEpicId - Épica destino opcional para reasignar historias huérfanas.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async deleteEpic(
      _: unknown,
      { id, targetEpicId }: { id: string; targetEpicId?: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      // Obtener el projectId de la BD para verificar el permiso del recurso correcto
      const epic = await context.prisma.epic.findUnique({ where: { id }, select: { projectId: true } });
      if (epic) await requirePermission(context, epic.projectId, 'backlog:write');
      return makeService(context).deleteEpic(context.user.id, id, targetEpicId);
    },

    /**
     * Reordena las épicas de un proyecto asignando nuevos valores de `order`
     * según el array `orderedIds`. La posición en el array determina el nuevo orden.
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param projectId  - ID del proyecto cuyas épicas se reordenan.
     * @param orderedIds - Array de IDs de épicas en el nuevo orden deseado.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async reorderEpics(
      _: unknown,
      { projectId, orderedIds }: { projectId: string; orderedIds: string[] },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).reorderEpics(context.user.id, projectId, orderedIds);
    },
  },

  Epic: {
    /**
     * Resuelve las historias de usuario de la épica, ordenadas por `order` ascendente.
     * Se ejecuta de forma perezosa: solo cuando el cliente solicita el campo `userStories`.
     *
     * @param parent - Épica padre resuelta en el nivel superior.
     * @param _ - Sin argumentos adicionales.
     * @param prisma - Cliente Prisma del contexto de Apollo.
     */
    async userStories(parent: { id: string }, _: unknown, { prisma }: GraphQLContext) {
      return prisma.userStory.findMany({
        where: { epicId: parent.id },
        orderBy: { order: 'asc' },
      });
    },
  },
};
