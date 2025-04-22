/**
 * @file user-story.resolver.ts
 * @description Resolvers GraphQL para el módulo de Historias de Usuario.
 *
 * Expone queries con filtros flexibles (sprint, épica, backlog), mutaciones para
 * el ciclo de vida completo de una historia y resolvers de campo para las relaciones.
 *
 * Efectos secundarios en mutaciones (todos fire-and-forget):
 * - Auditoría: registra en AuditLog cada campo modificado con diff de valor.
 * - Event bus: publica eventos para integraciones externas (Slack, GitHub, etc.).
 * - Subscripciones: notifica el tablero y el burndown chart en tiempo real.
 * - Notificaciones WebSocket: alertas push a Scrum Masters al bloquear historias.
 *
 * Control de acceso por operación:
 * - Crear/actualizar/mover/bloquear: permiso `board:move` o `backlog:write`.
 * - Eliminar/reordenar: permiso `backlog:write` (solo PO y SM).
 * - Mover a sprint: permiso `sprint:manage` (solo PO y SM).
 */
import { GraphQLContext } from '../../graphql/context';
import { UserStoryService } from './user-story.service';
import { UserStoryRepository } from './user-story.repository';
import { requireAuth } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { pubsub, BOARD_UPDATED_CHANNEL, SPRINT_BURNDOWN_UPDATED_CHANNEL } from '../../realtime/pubsub';
import { publishNotificationAdded } from '../../realtime/notification.socket';
import { AuditService } from '../audit/audit.service';
import { diffStoryFields } from '../audit/audit.utils';
import { eventBus } from '../../events/event-bus';
import { EventType, AggregateType } from '../../events/event-types';

/**
 * Crea una instancia de UserStoryService por petición para garantizar
 * aislamiento entre solicitudes concurrentes.
 *
 * @param context - Contexto GraphQL con el cliente Prisma de la petición
 * @returns Instancia de UserStoryService lista para usar
 */
function makeService(context: GraphQLContext) {
  return new UserStoryService(new UserStoryRepository(context.prisma), context.prisma);
}

/**
 * Obtiene el projectId de una historia de usuario a partir de su ID.
 * Se usa como paso previo a la verificación de permisos en mutaciones,
 * ya que los argumentos solo proveen el ID de la historia.
 *
 * @param prisma - Cliente de BD del contexto de la petición
 * @param id     - ID de la historia de usuario
 * @returns El projectId asociado o null si la historia no existe
 */
async function getStoryProjectId(prisma: GraphQLContext['prisma'], id: string): Promise<string | null> {
  const story = await prisma.userStory.findUnique({ where: { id }, select: { projectId: true } });
  return story?.projectId ?? null;
}

/**
 * Resolvers GraphQL para el módulo de Historias de Usuario.
 *
 * Expone queries para consultar historias (con filtros de sprint/épica),
 * mutaciones para el ciclo de vida completo (crear, actualizar, eliminar,
 * mover a sprint, bloquear/desbloquear, reordenar) y resolvers de campo
 * para las relaciones (epic, sprint, assignee, tasks).
 *
 * Efectos secundarios en mutaciones:
 * - Auditoría: registra cambios de campos en AuditLog (fire-and-forget).
 * - Eventos: publica en el event bus para integraciones (fire-and-forget).
 * - Subscripciones: notifica el tablero y el burndown en tiempo real.
 * - Notificaciones: push en tiempo real cuando una historia se bloquea.
 */
export const userStoryResolvers = {
  Query: {
    /**
     * Devuelve historias de usuario de un proyecto con filtros opcionales.
     * Si se proporciona `sprintId`, devuelve las del sprint; si es null, el backlog.
     * Si se proporciona `epicId`, filtra por épica.
     *
     * @param projectId - ID del proyecto (obligatorio)
     * @param sprintId  - Filtrar por sprint (null = backlog, undefined = todos)
     * @param epicId    - Filtrar por épica (null = sin épica, undefined = todas)
     */
    async userStories(
      _: unknown,
      { projectId, sprintId, epicId }: { projectId: string; sprintId?: string; epicId?: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).getUserStories({ projectId, sprintId, epicId });
    },

    /**
     * Obtiene una historia de usuario por su ID.
     * Lanza NotFoundError si no existe.
     *
     * @param id - ID de la historia
     */
    async userStory(_: unknown, { id }: { id: string }, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).getUserStory(id);
    },

    /**
     * Devuelve todas las historias del backlog del proyecto (sin sprint asignado).
     * Ordenadas por campo `order` para respetar la priorización del PO.
     *
     * @param projectId - ID del proyecto
     */
    async backlog(_: unknown, { projectId }: { projectId: string }, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).getBacklog(projectId);
    },
  },

  Mutation: {
    /**
     * Crea una nueva historia de usuario en el backlog del proyecto.
     * Tras la creación registra un audit log y publica el evento USER_STORY_CREATED
     * en el event bus para que otros módulos (ej. notificaciones) reaccionen.
     *
     * @param input - Datos de la historia: título, descripción, épica, prioridad, puntos, asignado
     */
    async createUserStory(
      _: unknown,
      { input }: { input: { title: string; description?: string; projectId: string; epicId?: string; priority?: string; points?: number; assigneeId?: string } },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      await requirePermission(context, input.projectId, 'backlog:write');
      const created = await makeService(context).createUserStory(context.user.id, input);

      // Registrar la creación en el audit log (fire-and-forget — no bloquea la respuesta)
      new AuditService(context.prisma).log({
        entityType: 'UserStory', entityId: created.id, action: 'CREATED',
        userId: context.user.id, projectId: input.projectId,
      }).catch(() => {});

      // Publicar evento para integraciones externas y automatizaciones (fire-and-forget)
      eventBus.publish({
        type: EventType.USER_STORY_CREATED,
        aggregateId: created.id,
        aggregateType: AggregateType.USER_STORY,
        payload: { id: created.id, title: created.title, workspaceId: context.workspaceId ?? '' },
        userId: context.user.id,
      }).catch(() => {});

      return created;
    },

    /**
     * Actualiza los campos de una historia de usuario.
     *
     * Efectos adicionales al actualizar:
     * 1. Audit diff: registra en AuditLog cada campo que cambió.
     * 2. Evento USER_STORY_STATUS_CHANGED: se publica si el nuevo status es DONE.
     * 3. Subscription boardUpdated: notifica a clientes suscritos si el status cambió.
     * 4. Subscription burndownUpdated: actualiza el burndown si la historia está en un sprint.
     *
     * @param id    - ID de la historia a actualizar
     * @param input - Campos a modificar (solo los incluidos se actualizan)
     */
    async updateUserStory(
      _: unknown,
      { id, input }: { id: string; input: Record<string, unknown> },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      const projectId = await getStoryProjectId(context.prisma, id);
      if (projectId) await requirePermission(context, projectId, 'board:move');

      // Capturar el estado anterior para calcular el diff de auditoría
      const previous = await context.prisma.userStory.findUnique({ where: { id } });
      const updated = await makeService(context).updateUserStory(context.user.id, id, input);

      // Registrar en audit log los campos que cambiaron (fire-and-forget)
      if (projectId && previous) {
        const auditSvc = new AuditService(context.prisma);
        const diffs = diffStoryFields(
          previous as unknown as Record<string, unknown>,
          input as Record<string, unknown>,
          projectId,
          context.user.id,
          id,
        );
        for (const diff of diffs) {
          auditSvc.log(diff).catch(() => {});
        }
      }

      // Publicar evento cuando la historia se completa para que el event bus notifique
      if (input.status === 'DONE') {
        eventBus.publish({
          type: EventType.USER_STORY_STATUS_CHANGED,
          aggregateId: updated.id,
          aggregateType: AggregateType.USER_STORY,
          payload: { id: updated.id, title: updated.title, newStatus: 'DONE', workspaceId: context.workspaceId ?? '' },
          userId: context.user.id,
        }).catch(() => {});
      }

      // Publicar al canal del tablero cuando cambia el estado (ej. drag & drop entre columnas)
      if (input.status && projectId) {
        pubsub.publish(BOARD_UPDATED_CHANNEL(projectId), { boardUpdated: updated }).catch(() => {});
        // También notificar al burndown para que recalcule cuando se completa o mueve una historia
        if (updated.sprintId) {
          pubsub.publish(SPRINT_BURNDOWN_UPDATED_CHANNEL(updated.sprintId), { burndownUpdated: null }).catch(() => {});
        }
      }

      return updated;
    },

    /**
     * Elimina permanentemente una historia de usuario.
     * Requiere el permiso `backlog:write` (PO o SM).
     *
     * @param id - ID de la historia a eliminar
     * @returns true si se eliminó correctamente
     */
    async deleteUserStory(_: unknown, { id }: { id: string }, context: GraphQLContext) {
      requireAuth(context);
      const projectId = await getStoryProjectId(context.prisma, id);
      if (projectId) await requirePermission(context, projectId, 'backlog:write');
      return makeService(context).deleteUserStory(context.user.id, id);
    },

    /**
     * Mueve una historia de usuario a un sprint o la devuelve al backlog.
     * Requiere permiso `sprint:manage` porque alterar el contenido de un sprint
     * es responsabilidad del PO o SM.
     *
     * @param storyId  - ID de la historia a mover
     * @param sprintId - ID del sprint destino; undefined/null = mover al backlog
     */
    async moveToSprint(
      _: unknown,
      { storyId, sprintId }: { storyId: string; sprintId?: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      const projectId = await getStoryProjectId(context.prisma, storyId);
      if (projectId) await requirePermission(context, projectId, 'sprint:manage');
      // null explícito indica "mover al backlog" (sin sprint)
      return makeService(context).moveToSprint(context.user.id, storyId, sprintId ?? null);
    },

    /**
     * Marca una historia como bloqueada con una razón de bloqueo.
     * Tras bloquear, notifica en tiempo real a todos los Scrum Masters del proyecto
     * para que puedan actuar como facilitadores y resolver el impedimento.
     *
     * @param id     - ID de la historia a bloquear
     * @param reason - Explicación del motivo del bloqueo
     */
    async blockStory(
      _: unknown,
      { id, reason }: { id: string; reason: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      const projectId = await getStoryProjectId(context.prisma, id);
      if (projectId) await requirePermission(context, projectId, 'board:move');
      const { story, smNotifications } = await makeService(context).blockStory(context.user.id, id, reason);

      // Emitir las notificaciones por WebSocket a cada SM de forma asíncrona
      for (const notif of smNotifications) {
        publishNotificationAdded(notif.userId, notif).catch(() => {});
      }
      return story;
    },

    /**
     * Elimina el bloqueo de una historia y registra un comentario de desbloqueo.
     * El comentario queda como registro histórico de por qué se resolvió el bloqueo.
     *
     * @param id      - ID de la historia a desbloquear
     * @param comment - Explicación de cómo se resolvió el bloqueo
     */
    async unblockStory(
      _: unknown,
      { id, comment }: { id: string; comment: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      const projectId = await getStoryProjectId(context.prisma, id);
      if (projectId) await requirePermission(context, projectId, 'board:move');
      return makeService(context).unblockStory(context.user.id, id, comment);
    },

    /**
     * Reordena las historias del backlog moviendo una historia a una nueva posición.
     * También puede cambiar la épica de la historia al mismo tiempo.
     * Requiere permiso `backlog:write` (solo PO y SM pueden reordenar el backlog).
     *
     * @param projectId    - ID del proyecto
     * @param storyId      - ID de la historia a mover
     * @param newPosition  - Nueva posición en el backlog (0-based)
     * @param targetEpicId - Nueva épica; null = sin épica; undefined = sin cambio
     */
    async reorderBacklog(
      _: unknown,
      { projectId, storyId, newPosition, targetEpicId }: { projectId: string; storyId: string; newPosition: number; targetEpicId?: string | null },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      await requirePermission(context, projectId, 'backlog:write');
      return makeService(context).reorderBacklog(context.user.id, projectId, storyId, newPosition, targetEpicId);
    },

    /**
     * Importa historias de usuario desde un string CSV.
     * Cabeceras soportadas: title, description, priority, points, epicTitle.
     * La columna `title` es obligatoria; el resto son opcionales.
     *
     * @param projectId - ID del proyecto destino de las historias
     * @param csv       - Contenido del CSV como string (incluyendo cabecera)
     * @returns Resumen de la importación: importadas, omitidas y mensajes de error
     */
    async importStoriesCsv(
      _: unknown,
      { projectId, csv }: { projectId: string; csv: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).importFromCsv(projectId, csv, context.user.id);
    },
  },

  /**
   * Resolvers de campo para el tipo UserStory.
   * Resuelven relaciones bajo demanda para evitar cargar datos innecesarios
   * en consultas que no soliciten esos campos.
   */
  UserStory: {
    /**
     * Resuelve la épica de la historia; devuelve null si no tiene épica asignada.
     *
     * @param parent - Objeto UserStory con su epicId
     */
    async epic(parent: { epicId: string | null }, _: unknown, { prisma }: GraphQLContext) {
      if (!parent.epicId) return null;
      return prisma.epic.findUnique({ where: { id: parent.epicId } });
    },

    /**
     * Resuelve el sprint de la historia; devuelve null si está en el backlog.
     *
     * @param parent - Objeto UserStory con su sprintId
     */
    async sprint(parent: { sprintId: string | null }, _: unknown, { prisma }: GraphQLContext) {
      if (!parent.sprintId) return null;
      return prisma.sprint.findUnique({ where: { id: parent.sprintId } });
    },

    /**
     * Resuelve el usuario asignado a la historia; devuelve null si no hay asignado.
     *
     * @param parent - Objeto UserStory con su assigneeId
     */
    async assignee(parent: { assigneeId: string | null }, _: unknown, { prisma }: GraphQLContext) {
      if (!parent.assigneeId) return null;
      return prisma.user.findUnique({ where: { id: parent.assigneeId } });
    },

    /**
     * Resuelve las tareas de la historia, ordenadas por `order` para mantener
     * la secuencia de implementación definida por el desarrollador.
     *
     * @param parent - Objeto UserStory con su ID
     */
    async tasks(parent: { id: string }, _: unknown, { prisma }: GraphQLContext) {
      return prisma.task.findMany({ where: { userStoryId: parent.id }, orderBy: { order: 'asc' } });
    },
  },
};
