/**
 * @file user-story.service.ts
 * @description Servicio de negocio para la gestión de historias de usuario (backlog Scrum).
 *
 * Implementa las reglas del backlog Scrum:
 * - Cualquier miembro del equipo puede crear y actualizar historias.
 * - Solo PRODUCT_OWNER y SCRUM_MASTER pueden eliminar o reordenar el backlog.
 * - El bloqueo de historias notifica en tiempo real a todos los Scrum Masters
 *   del proyecto para que actúen como facilitadores.
 * - El desbloqueo requiere un comentario de resolución como registro histórico.
 * - La importación CSV valida, sanitiza y procesa cada fila de forma resiliente:
 *   los errores por fila se acumulan sin abortar el proceso completo.
 *
 * Decisión de diseño — merge de customFields:
 * Las actualizaciones de campos personalizados hacen merge (no reemplazo) para
 * permitir actualizaciones parciales sin perder campos no incluidos en la petición.
 */
import { UserStory, Notification, PrismaClient } from '@prisma/client';
import { UserStoryRepository } from './user-story.repository';
import { ForbiddenError, NotFoundError } from '../../utils/error.utils';
import { sanitizeString, limitLength } from '../../utils/sanitize.utils';
import { EmailService } from '../../services/email.service';
import { logger } from '../../utils/logger';

/** Instancia compartida del servicio de email (stateless, seguro de reutilizar) */
const emailService = new EmailService();

/**
 * Servicio de negocio para la gestión de historias de usuario.
 *
 * Implementa las reglas de negocio del backlog Scrum:
 * - Solo miembros del equipo pueden crear/actualizar historias.
 * - Solo PO y SM pueden eliminar historias o reordenar el backlog.
 * - El bloqueo notifica en tiempo real a todos los Scrum Masters.
 * - El desbloqueo registra un comentario como trazabilidad histórica.
 * - La importación CSV valida y sanitiza cada fila antes de crear.
 */
export class UserStoryService {
  constructor(
    private readonly repo: UserStoryRepository,
    private readonly db: PrismaClient,
  ) {}

  /**
   * Obtiene historias de usuario de un proyecto con filtros opcionales.
   *
   * @param filter.projectId - ID del proyecto (obligatorio)
   * @param filter.sprintId  - Filtrar por sprint (null = backlog, undefined = todos)
   * @param filter.epicId    - Filtrar por épica (null = sin épica, undefined = todas)
   * @returns Lista de historias ordenadas por `order`
   */
  async getUserStories(filter: {
    projectId: string;
    sprintId?: string;
    epicId?: string;
  }): Promise<UserStory[]> {
    return this.repo.findMany(filter);
  }

  /**
   * Devuelve las historias del backlog (sin sprint asignado).
   *
   * @param projectId - ID del proyecto
   * @returns Lista de historias del backlog ordenadas por `order`
   */
  async getBacklog(projectId: string): Promise<UserStory[]> {
    return this.repo.findBacklog(projectId);
  }

  /**
   * Obtiene una historia de usuario por ID.
   *
   * @param id - ID de la historia
   * @returns La historia encontrada
   * @throws NotFoundError si la historia no existe
   */
  async getUserStory(id: string): Promise<UserStory> {
    const story = await this.repo.findById(id);
    if (!story) throw new NotFoundError('Historia de usuario');
    return story;
  }

  /**
   * Crea una nueva historia de usuario en el backlog del proyecto.
   *
   * Sanitiza el título y la descripción para prevenir inyección de HTML/scripts
   * y limita su longitud para no superar los límites de la BD.
   *
   * @param userId - ID del usuario que crea la historia (debe ser miembro)
   * @param input  - Datos de la historia a crear
   * @returns La historia creada con su ID y orden calculado
   * @throws ForbiddenError si el usuario no es miembro del proyecto
   */
  async createUserStory(
    userId: string,
    input: {
      title: string;
      description?: string;
      projectId: string;
      epicId?: string;
      priority?: string;
      points?: number;
      assigneeId?: string;
    },
  ): Promise<UserStory> {
    await this.checkMembership(userId, input.projectId);
    // Sanitizar para prevenir XSS y limitar longitud según el esquema de BD
    const cleanTitle = limitLength(sanitizeString(input.title), 500);
    const cleanDescription = limitLength(sanitizeString(input.description ?? ''), 10000) || undefined;
    return this.repo.create({ ...input, title: cleanTitle, description: cleanDescription });
  }

  /**
   * Actualiza los campos de una historia de usuario.
   *
   * Si se actualizan campos personalizados (`customFields`), se hace un merge
   * con los campos existentes para no perder los que no se incluyen en la
   * actualización. Esto permite actualizar un campo custom sin afectar los demás.
   *
   * @param userId - ID del usuario que actualiza (debe ser miembro)
   * @param id     - ID de la historia a actualizar
   * @param data   - Campos a modificar
   * @returns La historia con los datos actualizados
   * @throws NotFoundError si la historia no existe
   * @throws ForbiddenError si el usuario no es miembro
   */
  async updateUserStory(
    userId: string,
    id: string,
    data: {
      title?: string;
      description?: string;
      epicId?: string | null;
      sprintId?: string | null;
      status?: string;
      priority?: string;
      points?: number | null;
      assigneeId?: string | null;
      order?: number;
      customFields?: Record<string, unknown>;
    },
  ): Promise<UserStory> {
    const story = await this.repo.findById(id);
    if (!story) throw new NotFoundError('Historia de usuario');
    await this.checkMembership(userId, story.projectId);

    const updateData = { ...data };
    if (data.customFields !== undefined) {
      // Merge de customFields: combinar los existentes con los nuevos
      // para no perder campos que no se incluyen en la actualización parcial
      updateData.customFields = {
        ...((story.customFields as object) ?? {}),
        ...data.customFields,
      };
    }

    return this.repo.update(id, updateData);
  }

  /**
   * Elimina permanentemente una historia de usuario.
   * Solo PO y SM tienen permiso para eliminar historias del backlog.
   *
   * @param userId - ID del usuario que solicita la eliminación
   * @param id     - ID de la historia a eliminar
   * @returns true si se eliminó correctamente
   * @throws NotFoundError si la historia no existe
   * @throws ForbiddenError si el usuario no tiene rol suficiente
   */
  async deleteUserStory(userId: string, id: string): Promise<boolean> {
    const story = await this.repo.findById(id);
    if (!story) throw new NotFoundError('Historia de usuario');
    await this.checkCanWrite(userId, story.projectId);
    await this.repo.delete(id);
    return true;
  }

  /**
   * Mueve una historia de usuario a un sprint o la devuelve al backlog.
   *
   * @param userId   - ID del usuario que realiza el movimiento
   * @param storyId  - ID de la historia a mover
   * @param sprintId - Sprint destino; null = mover al backlog
   * @returns La historia con el sprintId actualizado
   * @throws NotFoundError si la historia no existe
   * @throws ForbiddenError si el usuario no tiene rol de escritura
   */
  async moveToSprint(
    userId: string,
    storyId: string,
    sprintId: string | null,
  ): Promise<UserStory> {
    const story = await this.repo.findById(storyId);
    if (!story) throw new NotFoundError('Historia de usuario');
    await this.checkCanWrite(userId, story.projectId);
    return this.repo.update(storyId, { sprintId });
  }

  /**
   * Marca una historia como bloqueada y notifica a los Scrum Masters.
   *
   * Proceso:
   * 1. Actualiza `isBlocked = true` y guarda la razón del bloqueo.
   * 2. Crea una notificación en BD para cada SM del proyecto.
   * 3. Envía un email a cada SM de forma asíncrona (fire-and-forget).
   * 4. Devuelve la historia actualizada y las notificaciones creadas para
   *    que el resolver pueda emitirlas por WebSocket.
   *
   * @param userId - ID del usuario que reporta el bloqueo
   * @param id     - ID de la historia a bloquear
   * @param reason - Descripción del impedimento que bloquea la historia
   * @returns La historia actualizada y las notificaciones creadas para los SMs
   */
  async blockStory(
    userId: string,
    id: string,
    reason: string,
  ): Promise<{ story: UserStory; smNotifications: Notification[] }> {
    const story = await this.repo.findById(id);
    if (!story) throw new NotFoundError('Historia de usuario');
    await this.checkMembership(userId, story.projectId);

    const updated = await this.repo.update(id, { isBlocked: true, blockedReason: reason });

    // Obtener todos los SM del proyecto para notificarlos
    const project = await this.db.project.findUnique({ where: { id: story.projectId } });
    const smMembers = await this.db.teamMember.findMany({
      where: { teamId: project!.teamId, role: 'SCRUM_MASTER' },
    });

    const smNotifications: Notification[] = [];
    for (const sm of smMembers) {
      // Crear notificación en BD para que persista en el centro de notificaciones
      const notif = await this.db.notification.create({
        data: {
          userId: sm.userId,
          type: 'STORY_BLOCKED',
          payload: JSON.stringify({ storyId: id, storyTitle: story.title, reason, blockedBy: userId }),
        },
      });
      smNotifications.push(notif);

      // Enviar email al SM (fire-and-forget para no bloquear la respuesta)
      const smUser = await this.db.user.findUnique({ where: { id: sm.userId } });
      if (smUser) {
        emailService
          .sendStoryBlockedEmail(smUser.email, smUser.name, story.title, reason, project!.name)
          .catch((err) => logger.error({ err }, 'Error sending story-blocked email'));
      }
    }

    return { story: updated, smNotifications };
  }

  /**
   * Reordena las historias del backlog moviendo una historia a una nueva posición.
   *
   * @param userId       - ID del usuario que realiza el reorden (debe ser PO o SM)
   * @param projectId    - ID del proyecto
   * @param storyId      - ID de la historia que se mueve
   * @param newPosition  - Nueva posición en el backlog (0-based)
   * @param targetEpicId - Nueva épica; null = sin épica; undefined = sin cambio
   * @returns Lista completa del backlog con los nuevos órdenes
   */
  async reorderBacklog(
    userId: string,
    projectId: string,
    storyId: string,
    newPosition: number,
    targetEpicId?: string | null,
  ): Promise<UserStory[]> {
    await this.checkCanWrite(userId, projectId);
    return this.repo.reorder(projectId, storyId, newPosition, targetEpicId);
  }

  /**
   * Elimina el bloqueo de una historia y deja constancia en un comentario.
   * El comentario actúa como registro histórico de la resolución del impedimento.
   *
   * @param userId  - ID del usuario que desbloquea la historia
   * @param id      - ID de la historia a desbloquear
   * @param comment - Explicación de cómo se resolvió el bloqueo
   * @returns La historia actualizada con isBlocked = false
   */
  async unblockStory(userId: string, id: string, comment: string): Promise<UserStory> {
    const story = await this.repo.findById(id);
    if (!story) throw new NotFoundError('Historia de usuario');
    await this.checkMembership(userId, story.projectId);

    // Registrar el comentario de resolución antes de limpiar el estado de bloqueo
    await this.db.comment.create({
      data: { body: comment, authorId: userId, userStoryId: id },
    });

    return this.repo.update(id, { isBlocked: false, blockedReason: null });
  }

  /**
   * Importa historias de usuario desde un string CSV.
   *
   * Formato esperado:
   * - Primera fila: cabeceras (title, description, priority, points, epicTitle).
   * - Filas siguientes: datos (una historia por fila).
   * - La columna `title` es obligatoria; el resto son opcionales.
   *
   * Comportamiento ante errores:
   * - Los errores por fila se acumulan en el array `errors` sin abortar la importación.
   * - Las filas con título vacío o prioridad inválida se omiten (skipped++).
   * - Los puntos no numéricos se ignoran y la historia se crea sin puntos.
   * - Si no se encuentra la épica por título, se anota en la descripción.
   *
   * @param projectId - ID del proyecto destino
   * @param csv       - Contenido del CSV (incluye cabecera)
   * @param userId    - ID del usuario que ejecuta la importación (debe ser miembro)
   * @returns Resumen con contadores y mensajes de error por fila
   */
  async importFromCsv(
    projectId: string,
    csv: string,
    userId: string,
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    await this.checkMembership(userId, projectId);

    // Dividir por líneas y eliminar espacios y líneas vacías
    const lines = csv.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) {
      return { imported: 0, skipped: 0, errors: ['CSV must have a header row and at least one data row'] };
    }

    // Parsear cabeceras en minúsculas para hacer el matching case-insensitive
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const titleIdx = headers.indexOf('title');
    const descIdx = headers.indexOf('description');
    const priorityIdx = headers.indexOf('priority');
    const pointsIdx = headers.indexOf('points');
    const epicTitleIdx = headers.indexOf('epictitle');

    // La columna title es obligatoria; sin ella no se puede crear ninguna historia
    if (titleIdx === -1) {
      return { imported: 0, skipped: 0, errors: ['CSV must have a "title" column'] };
    }

    const validPriorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Procesar cada fila de datos (se salta la fila 0 que es la cabecera)
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      const rowNum = i + 1; // Número de fila legible por el usuario (1-indexed)

      const title = titleIdx !== -1 ? cols[titleIdx] : '';
      if (!title) {
        errors.push(`Row ${rowNum}: title is required`);
        skipped++;
        continue;
      }

      // Normalizar la prioridad a mayúsculas y validarla contra el enum
      let priority = priorityIdx !== -1 && cols[priorityIdx] ? cols[priorityIdx].toUpperCase() : 'MEDIUM';
      if (!validPriorities.includes(priority)) {
        errors.push(`Row ${rowNum}: invalid priority "${cols[priorityIdx]}", defaulting to MEDIUM`);
        priority = 'MEDIUM';
      }

      // Parsear puntos como entero; ignorar si no es numérico
      let points: number | null = null;
      if (pointsIdx !== -1 && cols[pointsIdx]) {
        const parsed = parseInt(cols[pointsIdx], 10);
        if (isNaN(parsed)) {
          errors.push(`Row ${rowNum}: points must be numeric, ignoring value "${cols[pointsIdx]}"`);
        } else {
          points = parsed;
        }
      }

      let description = descIdx !== -1 ? cols[descIdx] : undefined;

      // Intentar resolver la épica por título; si no existe, anotarla en la descripción
      let epicId: string | undefined;
      if (epicTitleIdx !== -1 && cols[epicTitleIdx]) {
        const epicTitle = cols[epicTitleIdx];
        const epic = await this.db.epic.findFirst({
          where: { projectId, title: epicTitle },
        });
        if (epic) {
          epicId = epic.id;
        } else {
          // Añadir la referencia a la épica en la descripción para no perder la información
          const note = `[Epic: ${epicTitle}]`;
          description = description ? `${description} ${note}` : note;
        }
      }

      try {
        await this.repo.create({ title, description, projectId, priority, points: points ?? undefined, epicId });
        imported++;
      } catch (err) {
        errors.push(`Row ${rowNum}: failed to create story — ${(err as Error).message}`);
        skipped++;
      }
    }

    return { imported, skipped, errors };
  }

  // ─── Helpers privados ───────────────────────────────────────────────────────

  /**
   * Verifica que el usuario sea miembro activo del equipo del proyecto.
   * Cualquier rol (DEVELOPER, SCRUM_MASTER, PRODUCT_OWNER) pasa esta verificación.
   *
   * @param userId    - ID del usuario a verificar
   * @param projectId - ID del proyecto
   * @throws NotFoundError si el proyecto no existe
   * @throws ForbiddenError si el usuario no es miembro del equipo
   */
  private async checkMembership(userId: string, projectId: string): Promise<void> {
    const project = await this.db.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Proyecto');
    const member = await this.db.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId: project.teamId } },
    });
    if (!member) throw new ForbiddenError('No eres miembro de este proyecto');
  }

  /**
   * Verifica que el usuario tenga rol PRODUCT_OWNER o SCRUM_MASTER,
   * que son los únicos autorizados a modificar el backlog (eliminar, reordenar).
   *
   * @param userId    - ID del usuario a verificar
   * @param projectId - ID del proyecto
   * @throws NotFoundError si el proyecto no existe
   * @throws ForbiddenError si el usuario no es miembro o no tiene rol suficiente
   */
  private async checkCanWrite(userId: string, projectId: string): Promise<void> {
    const project = await this.db.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Proyecto');
    const member = await this.db.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId: project.teamId } },
    });
    if (!member) throw new ForbiddenError('No eres miembro de este proyecto');
    if (!['PRODUCT_OWNER', 'SCRUM_MASTER'].includes(member.role)) {
      throw new ForbiddenError('Solo Product Owners y Scrum Masters pueden modificar el backlog');
    }
  }
}
