/**
 * @file reports.resolver.ts
 * @description Resolvers GraphQL para el módulo de Reportes Scrum.
 *
 * Expone dos tipos de reportes fundamentales en metodología ágil:
 *
 * - Burndown chart: visualiza el trabajo restante día a día en un sprint.
 *   Muestra la línea real vs la línea ideal de quema para detectar desviaciones.
 *
 * - Velocity report: compara puntos planificados vs completados por sprint
 *   para que el equipo pueda proyectar su capacidad en futuros sprints.
 *
 * La suscripción `burndownUpdated` mantiene el gráfico sincronizado en tiempo
 * real: cuando `updateUserStory` cambia el status de una historia, publica en
 * el canal del sprint y este resolver recalcula el burndown completo.
 *
 * Decisión de diseño — resolver de campo BurndownReport.sprint:
 * La relación se resuelve aquí (y no en el servicio) siguiendo el patrón
 * GraphQL donde cada tipo resuelve sus propias relaciones bajo demanda.
 */
import { GraphQLContext } from '../../graphql/context';
import { ReportsService } from './reports.service';
import { requireAuth } from '../../middleware/auth.middleware';
import { pubsub, SPRINT_BURNDOWN_UPDATED_CHANNEL } from '../../realtime/pubsub';

/**
 * Crea una instancia de ReportsService por petición.
 * El servicio de reportes no mantiene estado entre llamadas, pero se instancia
 * por petición para consistencia con el resto de módulos.
 *
 * @param context - Contexto GraphQL con el cliente Prisma de la petición
 * @returns Instancia de ReportsService lista para calcular reportes
 */
function makeService(context: GraphQLContext) {
  return new ReportsService(context.prisma);
}

/**
 * Resolvers GraphQL para el módulo de Reportes.
 *
 * Expone:
 * - Query `burndownReport`: gráfico de burndown de un sprint.
 * - Query `velocityReport`: velocidad histórica del equipo por sprint.
 * - Subscription `burndownUpdated`: actualiza el burndown en tiempo real cuando
 *   el estado de una historia del sprint cambia.
 *
 * El resolver de campo `BurndownReport.sprint` resuelve la relación con el sprint
 * para que el cliente pueda mostrar el nombre y las fechas junto al gráfico.
 */
export const reportsResolvers = {
  Query: {
    /**
     * Calcula el burndown chart de un sprint.
     *
     * Devuelve un punto por día desde el inicio del sprint hasta hoy (o fin del sprint).
     * Cada punto incluye los puntos restantes reales y la línea ideal de quema.
     * Requiere que el sprint tenga fechas de inicio y fin definidas.
     *
     * @param sprintId - ID del sprint cuyo burndown se calcula
     * @throws ValidationError si el sprint no tiene fechas definidas
     * @throws NotFoundError si el sprint no existe
     */
    async burndownReport(
      _: unknown,
      { sprintId }: { sprintId: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).getBurndownReport(sprintId);
    },

    /**
     * Calcula el reporte de velocidad del equipo para los últimos N sprints completados.
     *
     * Devuelve puntos planificados vs completados por sprint para que el PO
     * y el SM puedan proyectar la capacidad futura del equipo.
     *
     * @param projectId  - ID del proyecto
     * @param lastSprints - Número de sprints completados a incluir (por defecto 6)
     */
    async velocityReport(
      _: unknown,
      { projectId, lastSprints }: { projectId: string; lastSprints?: number },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).getVelocityReport(projectId, lastSprints);
    },

  },

  /**
   * Resolver de campo para el tipo BurndownReport.
   * Resuelve la relación con el Sprint a partir del ID embebido en el payload
   * del reporte. Se hace aquí (y no en el servicio) para seguir el patrón
   * de GraphQL donde cada tipo resuelve sus propias relaciones.
   */
  BurndownReport: {
    /**
     * Resuelve el sprint asociado al reporte de burndown.
     *
     * @param parent - Objeto BurndownReport con el ID del sprint embebido
     */
    async sprint(parent: { sprint: { id: string } }, _: unknown, { prisma }: GraphQLContext) {
      return prisma.sprint.findUnique({ where: { id: parent.sprint.id } });
    },
  },

  Subscription: {
    /**
     * Suscripción que emite un reporte de burndown actualizado cada vez que
     * el estado de alguna historia del sprint cambia (desencadenado por el
     * resolver de updateUserStory).
     *
     * El resolver de `resolve` recalcula el burndown completo para que el cliente
     * reciba datos frescos y no tenga que hacer una query adicional.
     *
     * @param sprintId - ID del sprint cuyo burndown se observa en tiempo real
     * @returns AsyncIterator que emite el BurndownReport recalculado
     */
    burndownUpdated: {
      subscribe: (_: unknown, { sprintId }: { sprintId: string }, context: GraphQLContext): AsyncIterator<unknown> => {
        requireAuth(context);
        // Suscribir al canal específico del sprint para aislar los eventos
        return pubsub.asyncIterableIterator([SPRINT_BURNDOWN_UPDATED_CHANNEL(sprintId)]);
      },
      // Al recibir el evento, recalcular el burndown con datos frescos de la BD
      resolve: async (_payload: unknown, { sprintId }: { sprintId: string }, context: GraphQLContext) => {
        return makeService(context).getBurndownReport(sprintId);
      },
    },
  },
};
