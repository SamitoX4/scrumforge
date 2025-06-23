/**
 * @file impediment.service.ts
 * @description Servicio de negocio para la gestión de impedimentos Scrum.
 *
 * Un impedimento es cualquier obstáculo que bloquea el progreso del equipo
 * durante un sprint. Este servicio implementa el ciclo de vida completo:
 * creación → asignación → resolución, con notificaciones automáticas a los
 * roles responsables (Scrum Master y Product Owner) en cada transición.
 *
 * Flujo de escalado automático:
 * - Un cron externo llama a `escalateStaleImpediments` periódicamente.
 * - Los impedimentos sin resolver por más de 2 días se escalan a los POs.
 */
import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../utils/error.utils';
import { logger } from '../../utils/logger';
import { publishNotificationAdded } from '../../realtime/notification.socket';
import { sanitizeString, limitLength } from '../../utils/sanitize.utils';
import { EmailService } from '../../services/email.service';

/** Instancia compartida del servicio de email (stateless, segura de reutilizar entre llamadas) */
const emailService = new EmailService();

/**
 * Servicio de negocio para la gestión de impedimentos Scrum.
 *
 * Gestiona el ciclo de vida de los impedimentos de un proyecto:
 * - Creación con notificación inmediata a los Scrum Masters.
 * - Cambios de estado (OPEN → IN_PROGRESS → RESOLVED) con validación de transiciones.
 * - Escalado automático a Product Owners cuando un impedimento lleva más de 2 días abierto.
 * - Notificación al creador cuando su impedimento se resuelve.
 */
export class ImpedimentService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Obtiene los impedimentos de un proyecto con filtros opcionales.
   * Los resultados se ordenan del más reciente al más antiguo para facilitar
   * el seguimiento de los impedimentos activos.
   *
   * @param projectId - ID del proyecto (obligatorio)
   * @param sprintId  - Filtrar por sprint específico (opcional)
   * @param status    - Filtrar por estado: OPEN | IN_PROGRESS | RESOLVED (opcional)
   * @returns Lista de impedimentos con los usuarios relacionados incluidos
   */
  async getImpediments(projectId: string, sprintId?: string, status?: string) {
    return this.db.impediment.findMany({
      where: {
        projectId,
        // Aplicar filtros opcionales solo si se proporcionan
        ...(sprintId ? { sprintId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        reportedBy: true,
        assignedTo: true,
        resolvedBy: true,
      },
    });
  }

  /**
   * Obtiene un impedimento por su ID incluyendo los usuarios relacionados.
   *
   * @param id - ID del impedimento
   * @returns El impedimento con reportedBy, assignedTo y resolvedBy incluidos
   * @throws NotFoundError si el impedimento no existe
   */
  async getImpediment(id: string) {
    const imp = await this.db.impediment.findUnique({
      where: { id },
      include: { reportedBy: true, assignedTo: true, resolvedBy: true },
    });
    if (!imp) throw new NotFoundError('Impediment');
    return imp;
  }

  /**
   * Crea un nuevo impedimento y notifica a los Scrum Masters del proyecto.
   *
   * El título y la descripción se sanitizan para prevenir XSS y se limitan
   * en longitud para respetar las restricciones de la base de datos.
   * La categoría e impacto tienen valores por defecto (OTHER y MEDIUM) si no
   * se especifican, garantizando que el impedimento siempre se pueda registrar.
   *
   * La notificación a los SMs se ejecuta con catch para no interrumpir la
   * creación si falla el sistema de notificaciones.
   *
   * @param reportedById - ID del usuario que reporta el impedimento
   * @param input        - Datos del impedimento a crear
   * @returns El impedimento creado con los usuarios relacionados incluidos
   */
  async create(
    reportedById: string,
    input: {
      title: string;
      description?: string;
      category?: string;
      impact?: string;
      projectId: string;
      sprintId?: string;
      assignedToId?: string;
    },
  ) {
    // Sanitizar entradas para prevenir inyección de HTML/scripts
    const cleanTitle = limitLength(sanitizeString(input.title), 500);
    const cleanDescription = limitLength(sanitizeString(input.description ?? ''), 10000) || undefined;
    const imp = await this.db.impediment.create({
      data: {
        title: cleanTitle,
        description: cleanDescription,
        // Usar valores por defecto si no se especifican categoría e impacto
        category: input.category ?? 'OTHER',
        impact: input.impact ?? 'MEDIUM',
        status: 'OPEN',
        projectId: input.projectId,
        sprintId: input.sprintId,
        reportedById,
        assignedToId: input.assignedToId,
      },
      include: { reportedBy: true, assignedTo: true, resolvedBy: true },
    });

    // Notificar a los Scrum Masters de forma asíncrona sin bloquear la respuesta
    await this.notifyScrumMasters(input.projectId, imp.id, imp.title).catch((err) =>
      logger.error({ err }, 'Error notifying SM on impediment creation'),
    );

    return imp;
  }

  /**
   * Actualiza el estado de un impedimento y notifica según la transición.
   *
   * Transiciones válidas: OPEN → IN_PROGRESS → RESOLVED
   * (también se permite OPEN → RESOLVED directamente).
   *
   * Al resolver, se requiere un comentario explicando cómo se solucionó
   * el impedimento, y se notifica al usuario que lo reportó.
   *
   * @param id              - ID del impedimento a actualizar
   * @param status          - Nuevo estado: OPEN | IN_PROGRESS | RESOLVED
   * @param resolvedById    - ID del usuario que resuelve (requerido si status = RESOLVED)
   * @param resolvedComment - Explicación de la resolución (requerido si status = RESOLVED)
   * @returns El impedimento actualizado con los usuarios relacionados
   * @throws ValidationError si el estado no es válido o falta el comentario de resolución
   */
  async updateStatus(
    id: string,
    status: string,
    resolvedById?: string,
    resolvedComment?: string,
  ) {
    // Validar que el estado sea uno de los valores del enum
    const valid = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
    if (!valid.includes(status)) throw new ValidationError(`Invalid status: ${status}`);

    const data: Record<string, unknown> = { status };
    if (status === 'RESOLVED') {
      // La resolución siempre debe documentarse para trazabilidad del equipo
      if (!resolvedComment) throw new ValidationError('Se requiere comentario de resolución');
      data.resolvedById = resolvedById;
      data.resolvedComment = resolvedComment;
    }

    const imp = await this.db.impediment.update({
      where: { id },
      data,
      include: { reportedBy: true, assignedTo: true, resolvedBy: true },
    });

    // Notificar al reportador cuando su impedimento queda resuelto
    if (status === 'RESOLVED') {
      await this.notifyImpedimentResolved(imp).catch((err) =>
        logger.error({ err }, 'Error notifying on impediment resolved'),
      );
    }

    return imp;
  }

  /**
   * Asigna un impedimento a un usuario y lo pone automáticamente en estado IN_PROGRESS.
   * La transición al estado IN_PROGRESS es implícita: asignar un impedimento
   * indica que alguien ha tomado responsabilidad de resolverlo.
   *
   * @param id           - ID del impedimento a asignar
   * @param assignedToId - ID del usuario responsable de resolver el impedimento
   * @returns El impedimento actualizado con el nuevo responsable y estado IN_PROGRESS
   */
  async assign(id: string, assignedToId: string) {
    return this.db.impediment.update({
      where: { id },
      // La asignación cambia automáticamente el estado a IN_PROGRESS
      data: { assignedToId, status: 'IN_PROGRESS' },
      include: { reportedBy: true, assignedTo: true, resolvedBy: true },
    });
  }

  /**
   * Elimina un impedimento permanentemente.
   *
   * @param id - ID del impedimento a eliminar
   * @returns true si se eliminó correctamente
   */
  async delete(id: string): Promise<boolean> {
    await this.db.impediment.delete({ where: { id } });
    return true;
  }

  /**
   * Tarea cron: escala los impedimentos sin actividad durante más de 2 días.
   *
   * Busca impedimentos en estado OPEN que aún no hayan sido escalados
   * (`escalatedAt === null`) y cuya fecha de creación supere el umbral de 2 días.
   * Por cada uno: marca `escalatedAt` con la fecha actual y notifica a los POs
   * para que puedan priorizar su resolución.
   *
   * Este método es invocado por un scheduler externo (cron) y no por el resolver GraphQL.
   */
  async escalateStaleImpediments(): Promise<void> {
    // Calcular el umbral: hace exactamente 2 días desde ahora
    const threshold = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const stale = await this.db.impediment.findMany({
      // Solo impedimentos abiertos, no escalados previamente y más antiguos que el umbral
      where: { status: 'OPEN', escalatedAt: null, createdAt: { lt: threshold } },
    });
    for (const imp of stale) {
      // Marcar como escalado antes de notificar para evitar doble notificación
      await this.db.impediment.update({ where: { id: imp.id }, data: { escalatedAt: new Date() } });
      await this.notifyProductOwners(imp.projectId, imp.id, imp.title).catch(() => {});
    }
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  /**
   * Notifica a todos los Scrum Masters del proyecto sobre un nuevo impedimento.
   * Crea una notificación persistente en BD y la emite por WebSocket en tiempo real.
   *
   * @param projectId    - ID del proyecto para encontrar los SMs
   * @param impedimentId - ID del impedimento recién creado
   * @param title        - Título del impedimento (para el mensaje de notificación)
   */
  private async notifyScrumMasters(projectId: string, impedimentId: string, title: string) {
    const members = await this.getProjectMembers(projectId, 'SCRUM_MASTER');
    for (const userId of members) {
      const notif = await this.db.notification.create({
        data: {
          userId,
          type: 'IMPEDIMENT_CREATED',
          payload: JSON.stringify({ impedimentId, title, message: `Nuevo impedimento: "${title}"` }),
        },
      });
      // Emitir en tiempo real por WebSocket al Scrum Master conectado
      await publishNotificationAdded(userId, notif);
    }
  }

  /**
   * Notifica a los Product Owners sobre un impedimento sin resolver por más de 2 días.
   * Combina una notificación en tiempo real (WebSocket) y un email para mayor visibilidad.
   *
   * @param projectId    - ID del proyecto para encontrar los POs
   * @param impedimentId - ID del impedimento escalado
   * @param title        - Título del impedimento escalado
   */
  private async notifyProductOwners(projectId: string, impedimentId: string, title: string) {
    const members = await this.getProjectMembers(projectId, 'PRODUCT_OWNER');
    const project = await this.db.project.findUnique({ where: { id: projectId } });
    for (const userId of members) {
      const notif = await this.db.notification.create({
        data: {
          userId,
          type: 'IMPEDIMENT_ESCALATED',
          payload: JSON.stringify({ impedimentId, title, message: `Impedimento sin resolver >2 días: "${title}"` }),
        },
      });
      // Notificación en tiempo real por WebSocket
      await publishNotificationAdded(userId, notif);

      // Enviar también email al Product Owner para visibilidad fuera de la app
      const poUser = await this.db.user.findUnique({ where: { id: userId } });
      if (poUser && project) {
        emailService
          .sendImpedimentEscalatedEmail(poUser.email, poUser.name, title, project.name)
          .catch((err) => logger.error({ err }, 'Error sending impediment-escalated email'));
      }
    }
  }

  /**
   * Notifica al usuario que reportó el impedimento cuando este queda resuelto.
   * Emite la notificación por WebSocket para que vea el cierre en tiempo real.
   *
   * @param imp - Objeto con los datos mínimos del impedimento resuelto
   */
  private async notifyImpedimentResolved(imp: { id: string; title: string; projectId: string; reportedById: string }) {
    const notif = await this.db.notification.create({
      data: {
        userId: imp.reportedById,
        type: 'IMPEDIMENT_RESOLVED',
        payload: JSON.stringify({ impedimentId: imp.id, title: imp.title, message: `Impedimento resuelto: "${imp.title}"` }),
      },
    });
    // Emitir la notificación al reportador en tiempo real
    await publishNotificationAdded(imp.reportedById, notif);
  }

  /**
   * Obtiene los IDs de los miembros del equipo con un rol específico en el proyecto.
   * Utilizado internamente para construir las listas de destinatarios de notificaciones.
   *
   * @param projectId - ID del proyecto
   * @param role      - Rol a filtrar (ej. 'SCRUM_MASTER', 'PRODUCT_OWNER')
   * @returns Array de userIds con ese rol en el equipo del proyecto
   */
  private async getProjectMembers(projectId: string, role: string): Promise<string[]> {
    const project = await this.db.project.findUnique({
      where: { id: projectId },
      // Filtrar miembros del equipo directamente en la query para evitar filtrado en memoria
      include: { team: { include: { members: { where: { role } } } } },
    });
    return project?.team.members.map((m) => m.userId) ?? [];
  }
}
