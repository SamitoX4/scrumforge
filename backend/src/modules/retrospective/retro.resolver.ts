/**
 * @file retro.resolver.ts
 * @module retrospective
 * @description Resolvers de GraphQL para el módulo de retrospectivas.
 *
 * Las retrospectivas son sesiones estructuradas del equipo Scrum para
 * reflexionar sobre el sprint finalizado. Este módulo gestiona:
 * - Creación de sesiones con diferentes plantillas (START_STOP_CONTINUE, etc.).
 * - Adición y eliminación de tarjetas por columna.
 * - Creación de acciones de mejora con asignación y fecha límite.
 * - Toggle de acciones completadas.
 * - Cierre de la retrospectiva.
 *
 * La resolución del último elemento añadido (tarjeta o acción) en las
 * mutaciones correspondientes se hace buscando en la lista retornada
 * por `publishUpdate`, que ya contiene todos los datos actualizados.
 */

import { GraphQLContext } from '../../graphql/context';
import { RetroService } from './retro.service';
import { requireAuth } from '../../middleware/auth.middleware';

/**
 * Instancia el servicio de retrospectivas con el cliente Prisma del contexto.
 *
 * @param ctx - Contexto GraphQL de la petición.
 * @returns Nueva instancia de RetroService.
 */
function makeService(ctx: GraphQLContext) {
  return new RetroService(ctx.prisma);
}

/**
 * Mapa de resolvers para el módulo de retrospectivas.
 */
export const retroResolvers = {
  Query: {
    /**
     * Retorna todas las retrospectivas de un proyecto ordenadas
     * de más reciente a más antigua.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param projectId - ID del proyecto.
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns Lista de retrospectivas con tarjetas y acciones incluidas.
     */
    async retrospectives(_: unknown, { projectId }: { projectId: string }, ctx: GraphQLContext) {
      requireAuth(ctx);
      return makeService(ctx).getAll(projectId);
    },

    /**
     * Retorna una retrospectiva concreta por su ID con todas sus tarjetas
     * y acciones de mejora.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param id - ID de la retrospectiva.
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns La retrospectiva con tarjetas ordenadas por votos y acciones por fecha.
     */
    async retrospective(_: unknown, { id }: { id: string }, ctx: GraphQLContext) {
      requireAuth(ctx);
      return makeService(ctx).getOne(id);
    },
  },

  Mutation: {
    /**
     * Crea una nueva sesión de retrospectiva para un proyecto.
     * La plantilla por defecto es `START_STOP_CONTINUE` si no se especifica.
     * El usuario que crea la sesión queda registrado como `createdById`.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param projectId - ID del proyecto.
     * @param title - Título descriptivo de la retrospectiva.
     * @param template - Plantilla de formato (opcional).
     * @param sprintId - Sprint asociado (opcional).
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns La retrospectiva recién creada con listas vacías de tarjetas y acciones.
     */
    async createRetrospective(
      _: unknown,
      { projectId, title, template, sprintId }: { projectId: string; title: string; template?: string; sprintId?: string },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx);
      // Se usa START_STOP_CONTINUE como plantilla por defecto si no se especifica otra
      return makeService(ctx).create(projectId, title, template ?? 'START_STOP_CONTINUE', sprintId, ctx.user.id);
    },

    /**
     * Agrega una tarjeta a una columna de la retrospectiva.
     * Tras la creación, se publica el estado completo por PubSub para
     * sincronizar en tiempo real todos los participantes conectados.
     * Se busca la tarjeta recién creada en la lista retornada.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param retroId - ID de la retrospectiva.
     * @param column - Columna donde se agrega la tarjeta (p.ej. "START", "STOP", "CONTINUE").
     * @param body - Texto de la tarjeta.
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns La tarjeta recién creada.
     */
    async addRetroCard(_: unknown, { retroId, column, body }: { retroId: string; column: string; body: string }, ctx: GraphQLContext) {
      requireAuth(ctx);
      const retro = await makeService(ctx).addCard(retroId, column, body, ctx.user.id);
      // Se localiza la tarjeta recién añadida buscando por columna y cuerpo;
      // como fallback se usa la última tarjeta de la lista
      return retro.cards.find((c) => c.column === column && c.body === body) ?? retro.cards[retro.cards.length - 1];
    },

    /**
     * Elimina una tarjeta de la retrospectiva y publica el estado actualizado.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param id - ID de la tarjeta a eliminar.
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns `true` si la eliminación fue exitosa.
     */
    async deleteRetroCard(_: unknown, { id }: { id: string }, ctx: GraphQLContext) {
      requireAuth(ctx);
      return makeService(ctx).deleteCard(id);
    },

    /**
     * Agrega una acción de mejora a la retrospectiva.
     * La acción puede tener un responsable y una fecha límite opcionales.
     * Se retorna solo la última acción de la lista (la recién creada).
     *
     * @param _ - Parent resolver; no utilizado.
     * @param retroId - ID de la retrospectiva.
     * @param title - Descripción de la acción de mejora.
     * @param assignedToId - ID del responsable de la acción (opcional).
     * @param dueDate - Fecha límite en formato ISO (opcional).
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns La acción de mejora recién creada.
     */
    async addRetroAction(
      _: unknown,
      { retroId, title, assignedToId, dueDate }: { retroId: string; title: string; assignedToId?: string; dueDate?: string },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx);
      const retro = await makeService(ctx).addAction(retroId, title, assignedToId, dueDate);
      // La acción recién creada siempre queda al final de la lista ordenada por fecha
      return retro.actions[retro.actions.length - 1];
    },

    /**
     * Alterna el estado de completitud de una acción de mejora.
     * Si estaba pendiente pasa a completada, y viceversa.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param id - ID de la acción a alternar.
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns La acción con el estado `done` actualizado.
     */
    async toggleRetroAction(_: unknown, { id }: { id: string }, ctx: GraphQLContext) {
      requireAuth(ctx);
      return makeService(ctx).toggleAction(id);
    },

    /**
     * Cierra la retrospectiva cambiando su estado a `CLOSED`.
     * Una retrospectiva cerrada no puede recibir nuevas tarjetas ni acciones.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param id - ID de la retrospectiva a cerrar.
     * @param ctx - Contexto GraphQL con usuario autenticado.
     * @returns La retrospectiva con estado actualizado a CLOSED.
     */
    async closeRetrospective(_: unknown, { id }: { id: string }, ctx: GraphQLContext) {
      requireAuth(ctx);
      return makeService(ctx).close(id);
    },
  },
};
