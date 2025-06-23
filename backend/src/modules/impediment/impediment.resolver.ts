/**
 * @file impediment.resolver.ts
 * @module impediment
 * @description Resolvers de GraphQL para el módulo de impedimentos.
 *
 * Un impedimento es un obstáculo que bloquea el progreso del equipo
 * durante un sprint. Este módulo permite reportarlos, asignarlos,
 * cambiar su estado y eliminarlos.
 *
 * Todos los resolvers exigen autenticación. El usuario que reporta
 * el impedimento se registra automáticamente desde el contexto de sesión.
 */

import { GraphQLContext } from '../../graphql/context';
import { ImpedimentService } from './impediment.service';
import { requireAuth } from '../../middleware/auth.middleware';

/**
 * Instancia el servicio de impedimentos con el cliente Prisma del contexto.
 *
 * @param ctx - Contexto GraphQL de la petición.
 * @returns Nueva instancia de ImpedimentService.
 */
function makeService(ctx: GraphQLContext) {
  return new ImpedimentService(ctx.prisma);
}

/**
 * Mapa de resolvers para el módulo de impedimentos.
 */
export const impedimentResolvers = {
  Query: {
    /**
     * Retorna los impedimentos de un proyecto con filtros opcionales por
     * sprint y/o estado. Permite mostrar solo los impedimentos abiertos
     * del sprint activo, por ejemplo.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param projectId - ID del proyecto.
     * @param sprintId - Filtro opcional por sprint.
     * @param status - Filtro opcional por estado (OPEN, IN_PROGRESS, RESOLVED).
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns Lista de impedimentos filtrados.
     */
    async impediments(
      _: unknown,
      { projectId, sprintId, status }: { projectId: string; sprintId?: string; status?: string },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx);
      return makeService(ctx).getImpediments(projectId, sprintId, status);
    },

    /**
     * Retorna un impedimento concreto por su ID.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param id - ID del impedimento.
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns El impedimento encontrado.
     */
    async impediment(_: unknown, { id }: { id: string }, ctx: GraphQLContext) {
      requireAuth(ctx);
      return makeService(ctx).getImpediment(id);
    },
  },

  Mutation: {
    /**
     * Crea un nuevo impedimento en el proyecto.
     * El campo `reportedById` se asigna automáticamente al usuario
     * autenticado para garantizar la trazabilidad.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param input - Datos del impedimento (título, descripción, categoría, impacto, etc.).
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns El impedimento recién creado.
     */
    async createImpediment(
      _: unknown,
      { input }: { input: { title: string; description?: string; category?: string; impact?: string; projectId: string; sprintId?: string; assignedToId?: string } },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx);
      // El reportador siempre es el usuario autenticado, no se puede falsificar
      return makeService(ctx).create(ctx.user.id, input);
    },

    /**
     * Cambia el estado de un impedimento (p.ej. de OPEN a RESOLVED).
     * Al resolver un impedimento se puede añadir un comentario explicativo.
     * El usuario que resuelve el impedimento se registra en `resolvedById`.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param id - ID del impedimento a actualizar.
     * @param status - Nuevo estado del impedimento.
     * @param resolvedComment - Comentario de resolución (opcional).
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns El impedimento con el estado actualizado.
     */
    async updateImpedimentStatus(
      _: unknown,
      { id, status, resolvedComment }: { id: string; status: string; resolvedComment?: string },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx);
      return makeService(ctx).updateStatus(id, status, ctx.user.id, resolvedComment);
    },

    /**
     * Asigna un impedimento a un miembro del equipo para su resolución.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param id - ID del impedimento a asignar.
     * @param assignedToId - ID del usuario al que se asigna.
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns El impedimento con la nueva asignación.
     */
    async assignImpediment(
      _: unknown,
      { id, assignedToId }: { id: string; assignedToId: string },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx);
      return makeService(ctx).assign(id, assignedToId);
    },

    /**
     * Elimina un impedimento por su ID.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param id - ID del impedimento a eliminar.
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns `true` si la eliminación fue exitosa.
     */
    async deleteImpediment(_: unknown, { id }: { id: string }, ctx: GraphQLContext) {
      requireAuth(ctx);
      return makeService(ctx).delete(id);
    },
  },
};
