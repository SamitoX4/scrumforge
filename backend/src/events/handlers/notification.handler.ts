/**
 * @file notification.handler.ts
 * @description Handlers de eventos de dominio responsables de crear notificaciones
 * en la aplicación. Cada handler se suscribe a un tipo de evento específico a través
 * del {@link EventBus} y, cuando se dispara, persiste registros en la tabla
 * `Notification` para que los usuarios vean el aviso en la UI.
 *
 * Se registran todos los handlers llamando a {@link registerNotificationHandlers}
 * durante el arranque del servidor, antes de que se procese cualquier petición.
 */

import { PrismaClient } from '@prisma/client';
import { eventBus } from '../event-bus';
import { EventType } from '../event-types';
import type { DomainEvent } from '../event-store';
import { logger } from '../../utils/logger';

/**
 * Registra todos los handlers de notificación en el EventBus.
 * Debe llamarse una sola vez durante el arranque de la aplicación,
 * después de que Prisma esté conectado.
 *
 * @param db - Instancia de PrismaClient para persistir notificaciones.
 */
export function registerNotificationHandlers(db: PrismaClient): void {
  // Cada handler se fabrica con el patrón factory para capturar `db` en closure
  eventBus.subscribe(EventType.SPRINT_STARTED,    makeSprintStartedHandler(db));
  eventBus.subscribe(EventType.SPRINT_COMPLETED,  makeSprintCompletedHandler(db));
  eventBus.subscribe(EventType.MEMBER_INVITED,    makeMemberInvitedHandler(db));
  eventBus.subscribe(EventType.USER_STORY_STATUS_CHANGED, makeStoryStatusChangedHandler(db));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Crea una notificación para cada miembro del equipo del proyecto indicado,
 * exceptuando opcionalmente al usuario que generó la acción.
 *
 * La función es tolerante a fallos: si el proyecto no existe o no tiene
 * miembros, retorna sin error.
 *
 * @param db            - Cliente Prisma para consultar el proyecto y crear notificaciones.
 * @param projectId     - ID del proyecto cuyos miembros recibirán la notificación.
 * @param type          - Tipo de notificación (cadena identificadora para la UI).
 * @param payload       - Datos adicionales que se serializarán en el campo `payload`.
 * @param excludeUserId - ID del usuario que NO debe recibir la notificación (ej. el autor).
 */
async function notifyTeamMembers(
  db: PrismaClient,
  projectId: string,
  type: string,
  payload: Record<string, unknown>,
  excludeUserId?: string,
): Promise<void> {
  // Carga el proyecto junto con todos los miembros de su equipo
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { team: { include: { members: true } } },
  });

  // Si el proyecto no existe, no hay nada que notificar
  if (!project) return;

  // Extrae los IDs de usuario y excluye al autor del evento si se indicó
  const recipients = project.team.members
    .map((m) => m.userId)
    .filter((id) => id !== excludeUserId);

  if (recipients.length === 0) return;

  // Inserta todas las notificaciones en una sola query para mayor eficiencia
  await db.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type,
      payload: JSON.stringify(payload),
    })),
  });
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * Crea un handler para el evento SPRINT_STARTED.
 * Notifica a todos los miembros del equipo del proyecto que un sprint ha comenzado.
 *
 * @param db - Cliente Prisma inyectado via closure.
 * @returns Handler asíncrono compatible con {@link EventBus.subscribe}.
 */
function makeSprintStartedHandler(db: PrismaClient) {
  return async (event: DomainEvent): Promise<void> => {
    const { projectId, sprintName } = event.payload as {
      projectId?: string;
      sprintName?: string;
    };

    // Sin projectId no es posible determinar a quién notificar
    if (!projectId) return;

    try {
      await notifyTeamMembers(db, projectId, 'SPRINT_STARTED', {
        sprintId: event.aggregateId,
        sprintName,
        message: `El sprint "${sprintName ?? ''}" ha comenzado.`,
      });
    } catch (err) {
      logger.error({ err, sprintId: event.aggregateId }, 'Error generando notificaciones de sprint iniciado');
    }
  };
}

/**
 * Crea un handler para el evento SPRINT_COMPLETED.
 * Notifica a los miembros del equipo el resumen de puntos completados vs totales.
 *
 * @param db - Cliente Prisma inyectado via closure.
 * @returns Handler asíncrono compatible con {@link EventBus.subscribe}.
 */
function makeSprintCompletedHandler(db: PrismaClient) {
  return async (event: DomainEvent): Promise<void> => {
    const { projectId, sprintName, completedPoints, totalPoints } = event.payload as {
      projectId?: string;
      sprintName?: string;
      completedPoints?: number;
      totalPoints?: number;
    };

    if (!projectId) return;

    try {
      await notifyTeamMembers(db, projectId, 'SPRINT_COMPLETED', {
        sprintId: event.aggregateId,
        sprintName,
        completedPoints,
        totalPoints,
        // Mensaje legible con el resultado del sprint (ej. "5/8 pts completados")
        message: `El sprint "${sprintName ?? ''}" ha finalizado. ${completedPoints ?? 0}/${totalPoints ?? 0} pts completados.`,
      });
    } catch (err) {
      logger.error({ err, sprintId: event.aggregateId }, 'Error generando notificaciones de sprint completado');
    }
  };
}

/**
 * Crea un handler para el evento MEMBER_INVITED.
 * Notifica ÚNICAMENTE al usuario invitado (no a todo el equipo) sobre su incorporación
 * al proyecto y el rol que le ha sido asignado.
 *
 * @param db - Cliente Prisma inyectado via closure.
 * @returns Handler asíncrono compatible con {@link EventBus.subscribe}.
 */
function makeMemberInvitedHandler(db: PrismaClient) {
  return async (event: DomainEvent): Promise<void> => {
    const { invitedUserId, projectId, role } = event.payload as {
      invitedUserId?: string;
      projectId?: string;
      role?: string;
    };

    // Se necesitan ambos IDs para crear la notificación; sin ellos no hay acción posible
    if (!invitedUserId || !projectId) return;

    try {
      // Consulta el nombre del proyecto para incluirlo en el mensaje de notificación
      const project = await db.project.findUnique({ where: { id: projectId } });
      if (!project) return;

      await db.notification.create({
        data: {
          userId: invitedUserId,
          type: 'MEMBER_INVITED',
          payload: JSON.stringify({
            projectId,
            projectName: project.name,
            role,
            message: `Has sido invitado al proyecto "${project.name}" como ${role ?? 'miembro'}.`,
          }),
        },
      });
    } catch (err) {
      logger.error({ err, invitedUserId }, 'Error generando notificación de invitación');
    }
  };
}

/**
 * Crea un handler para el evento USER_STORY_STATUS_CHANGED.
 * Notifica al usuario asignado a la historia cuando su estado cambia,
 * para que esté al tanto de avances o bloqueos.
 *
 * @param db - Cliente Prisma inyectado via closure.
 * @returns Handler asíncrono compatible con {@link EventBus.subscribe}.
 */
function makeStoryStatusChangedHandler(db: PrismaClient) {
  return async (event: DomainEvent): Promise<void> => {
    const { assigneeId, storyTitle, newStatus } = event.payload as {
      assigneeId?: string;
      storyTitle?: string;
      newStatus?: string;
    };

    // Solo notificamos si la historia tiene un usuario asignado
    if (!assigneeId) return;

    try {
      await db.notification.create({
        data: {
          userId: assigneeId,
          type: 'STORY_STATUS_CHANGED',
          payload: JSON.stringify({
            storyId: event.aggregateId,
            storyTitle,
            newStatus,
            message: `La historia "${storyTitle ?? ''}" cambió a estado ${newStatus ?? ''}.`,
          }),
        },
      });
    } catch (err) {
      logger.error({ err, storyId: event.aggregateId }, 'Error generando notificación de cambio de estado');
    }
  };
}
