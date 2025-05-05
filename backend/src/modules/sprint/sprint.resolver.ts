/**
 * @file sprint.resolver.ts
 * @description Resolvers GraphQL para el módulo de Sprints.
 *
 * Expone el CRUD de sprints y las transiciones de estado de su ciclo de vida:
 * crear (PLANNING) → iniciar (ACTIVE) → completar (COMPLETED) → eliminar.
 *
 * Control de acceso:
 * - Todas las operaciones requieren autenticación (`requireAuth`).
 * - Las mutaciones de gestión verifican el permiso `sprint:manage` (PO y SM).
 *
 * Efectos secundarios en mutaciones:
 * - Publicación de eventos en el event bus para integraciones (fire-and-forget).
 * - Los resolvers de campo `userStories` y `stats` se resuelven bajo demanda
 *   para no penalizar consultas que no los soliciten.
 */
import { GraphQLContext } from '../../graphql/context';
import { SprintService } from './sprint.service';
import { SprintRepository } from './sprint.repository';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { eventBus } from '../../events/event-bus';
import { EventType, AggregateType } from '../../events/event-types';

/**
 * Crea una instancia de SprintService con el PrismaClient del contexto
 * de la solicitud actual. Se instancia por petición en lugar de una sola
 * vez al iniciar el servidor para garantizar aislamiento entre solicitudes.
 *
 * @param context - Contexto GraphQL con prisma inyectado
 * @returns Instancia de SprintService lista para usar
 */
function makeService(context: GraphQLContext) {
  return new SprintService(new SprintRepository(context.prisma), context.prisma);
}

/**
 * Obtiene el projectId de un sprint a partir de su ID.
 * Se usa como paso previo a las verificaciones de permiso en mutaciones,
 * ya que los argumentos de entrada solo proveen el ID del sprint.
 *
 * @param prisma - Cliente de base de datos del contexto
 * @param id     - ID del sprint
 * @returns El projectId asociado, o null si el sprint no existe
 */
async function getSprintProjectId(prisma: GraphQLContext['prisma'], id: string): Promise<string | null> {
  const sprint = await prisma.sprint.findUnique({ where: { id }, select: { projectId: true } });
  return sprint?.projectId ?? null;
}

/**
 * Resolvers GraphQL para el módulo de Sprints.
 *
 * Expone queries para consultar sprints, mutaciones para gestionar su ciclo
 * de vida (crear → iniciar → completar → eliminar) y resolvers de campo para
 * las relaciones (userStories y stats).
 *
 * Control de acceso:
 * - Todas las operaciones requieren autenticación (`requireAuth`).
 * - Las mutaciones de gestión requieren el permiso `sprint:manage`, que
 *   solo tienen PRODUCT_OWNER y SCRUM_MASTER.
 */
export const sprintResolvers = {
  Query: {
    /**
     * Devuelve todos los sprints de un proyecto, ordenados por fecha de creación descendente.
     *
     * @param projectId - ID del proyecto cuyos sprints se quieren consultar
     */
    async sprints(_: unknown, { projectId }: { projectId: string }, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).getSprints(projectId);
    },

    /**
     * Obtiene un sprint específico por ID.
     * Lanza NotFoundError si el sprint no existe.
     *
     * @param id - ID del sprint a consultar
     */
    async sprint(_: unknown, { id }: { id: string }, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).getSprint(id);
    },

    /**
     * Devuelve el sprint actualmente activo del proyecto, o null si no hay ninguno.
     * Útil para la pantalla principal del tablero Kanban.
     *
     * @param projectId - ID del proyecto
     */
    async activeSprint(_: unknown, { projectId }: { projectId: string }, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).getActiveSprint(projectId);
    },
  },

  Mutation: {
    /**
     * Crea un nuevo sprint en estado PLANNING para el proyecto indicado.
     * No inicia el sprint; el inicio se hace con `startSprint` cuando el equipo
     * está listo para comenzar la iteración.
     *
     * @param input - Datos del sprint: nombre, goal opcional y fechas tentativas
     */
    async createSprint(
      _: unknown,
      { input }: { input: { name: string; goal?: string; projectId: string; startDate?: string; endDate?: string } },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      await requirePermission(context, input.projectId, 'sprint:manage');
      return makeService(context).createSprint(context.user.id, input);
    },

    /**
     * Transiciona un sprint de PLANNING a ACTIVE.
     * Valida que no haya otro sprint activo y luego publica el evento
     * SPRINT_STARTED en el bus para que otros módulos (notificaciones,
     * reportes) reaccionen. El evento es fire-and-forget para no bloquear
     * la respuesta al cliente.
     *
     * @param id    - ID del sprint a iniciar
     * @param input - Fechas definitivas y goal del sprint
     */
    async startSprint(
      _: unknown,
      { id, input }: { id: string; input: { goal?: string; startDate: string; endDate: string } },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      // Recuperar el projectId para verificar permisos antes de modificar
      const projectId = await getSprintProjectId(context.prisma, id);
      if (projectId) await requirePermission(context, projectId, 'sprint:manage');
      const startedSprint = await makeService(context).startSprint(context.user.id, id, input);
      // Publicar evento de forma asíncrona sin bloquear la respuesta
      eventBus.publish({
        type: EventType.SPRINT_STARTED,
        aggregateId: startedSprint.id,
        aggregateType: AggregateType.SPRINT,
        payload: { id: startedSprint.id, name: startedSprint.name, workspaceId: context.workspaceId ?? '' },
        userId: context.user.id,
      }).catch(() => {});
      return startedSprint;
    },

    /**
     * Marca un sprint activo como COMPLETED.
     * Las historias incompletas se pueden mover opcionalmente a otro sprint;
     * si no se especifica destino, regresan al backlog (sprintId = null).
     * También publica el evento SPRINT_COMPLETED para integraciones externas.
     *
     * @param id                       - ID del sprint a completar
     * @param moveIncompleteToSprintId - Sprint destino para las historias incompletas (opcional)
     */
    async completeSprint(
      _: unknown,
      { id, moveIncompleteToSprintId }: { id: string; moveIncompleteToSprintId?: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      const projectId = await getSprintProjectId(context.prisma, id);
      if (projectId) await requirePermission(context, projectId, 'sprint:manage');
      const completedSprint = await makeService(context).completeSprint(context.user.id, id, moveIncompleteToSprintId);
      // Publicar evento de cierre (fire-and-forget)
      eventBus.publish({
        type: EventType.SPRINT_COMPLETED,
        aggregateId: completedSprint.id,
        aggregateType: AggregateType.SPRINT,
        payload: { id: completedSprint.id, name: completedSprint.name, workspaceId: context.workspaceId ?? '' },
        userId: context.user.id,
      }).catch(() => {});
      return completedSprint;
    },

    /**
     * Elimina un sprint que no esté activo.
     * Las historias asociadas se devuelven al backlog antes de borrar el sprint.
     *
     * @param id - ID del sprint a eliminar
     * @returns true si se eliminó correctamente
     */
    async deleteSprint(_: unknown, { id }: { id: string }, context: GraphQLContext) {
      requireAuth(context);
      const projectId = await getSprintProjectId(context.prisma, id);
      if (projectId) await requirePermission(context, projectId, 'sprint:manage');
      return makeService(context).deleteSprint(context.user.id, id);
    },
  },

  Sprint: {
    /**
     * Resuelve las historias de usuario del sprint, ordenadas por `order`
     * para respetar la priorización del backlog.
     *
     * @param parent - Objeto Sprint con su ID
     */
    async userStories(parent: { id: string }, _: unknown, { prisma }: GraphQLContext) {
      return prisma.userStory.findMany({ where: { sprintId: parent.id }, orderBy: { order: 'asc' } });
    },

    /**
     * Calcula las estadísticas del sprint en tiempo real (puntos, progreso, etc.).
     * Se resuelve bajo demanda para no cargar datos innecesarios en consultas
     * que no pidan el campo `stats`.
     *
     * @param parent - Objeto Sprint con su ID
     */
    async stats(parent: { id: string }, _: unknown, context: GraphQLContext) {
      return makeService(context).getStats(parent.id);
    },
  },
};
