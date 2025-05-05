/**
 * @file sprint.service.ts
 * @description Servicio de negocio para la gestión del ciclo de vida de los sprints.
 *
 * Implementa las reglas Scrum fundamentales:
 * - Solo un sprint activo por proyecto a la vez.
 * - Solo PRODUCT_OWNER y SCRUM_MASTER pueden gestionar sprints.
 * - Las transiciones siguen el flujo: PLANNING → ACTIVE → COMPLETED.
 * - Al completar un sprint, los puntos planificados se capturan en la BD
 *   para que los reportes de velocidad sean históricamente precisos.
 * - Las notificaciones por email al equipo se envían de forma asíncrona
 *   (fire-and-forget) para no bloquear la respuesta GraphQL.
 */
import { Sprint, PrismaClient } from '@prisma/client';
import { SprintRepository } from './sprint.repository';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/error.utils';
import { EmailService } from '../../services/email.service';
import { logger } from '../../utils/logger';

/** Instancia compartida del servicio de email (stateless, segura de reutilizar) */
const emailService = new EmailService();

/**
 * Métricas calculadas en tiempo real para un sprint.
 * Se usan en el resolver del campo `stats` y en la pantalla de detalle del sprint.
 */
export interface SprintStats {
  /** Total de puntos de historia planificados en el sprint */
  totalPoints: number;
  /** Puntos de las historias completadas (status === 'DONE') */
  completedPoints: number;
  /** Número total de historias en el sprint */
  totalStories: number;
  /** Número de historias con status === 'DONE' */
  completedStories: number;
  /** Porcentaje de avance redondeado al entero más cercano (0-100) */
  progressPercent: number;
}

/**
 * Servicio de negocio para la gestión del ciclo de vida de los sprints.
 *
 * Implementa las reglas de Scrum:
 * - Solo un sprint activo por proyecto a la vez.
 * - Solo PRODUCT_OWNER y SCRUM_MASTER pueden gestionar sprints.
 * - Las transiciones de estado siguen el flujo PLANNING → ACTIVE → COMPLETED.
 * - Al completar, los puntos planificados se capturan en la BD para que
 *   los reportes de velocidad sean precisos aunque después se muevan historias.
 */
export class SprintService {
  constructor(
    private readonly repo: SprintRepository,
    private readonly db: PrismaClient,
  ) {}

  /**
   * Obtiene todos los sprints de un proyecto ordenados por fecha de creación.
   *
   * @param projectId - ID del proyecto
   * @returns Lista de sprints
   */
  async getSprints(projectId: string): Promise<Sprint[]> {
    return this.repo.findByProject(projectId);
  }

  /**
   * Obtiene un sprint por ID, lanzando NotFoundError si no existe.
   *
   * @param id - ID del sprint
   * @returns El sprint encontrado
   * @throws NotFoundError si el sprint no existe
   */
  async getSprint(id: string): Promise<Sprint> {
    const sprint = await this.repo.findById(id);
    if (!sprint) throw new NotFoundError('Sprint');
    return sprint;
  }

  /**
   * Devuelve el sprint activo del proyecto o null si no hay ninguno.
   *
   * @param projectId - ID del proyecto
   * @returns Sprint activo o null
   */
  async getActiveSprint(projectId: string): Promise<Sprint | null> {
    return this.repo.findActive(projectId);
  }

  /**
   * Calcula las estadísticas en tiempo real del sprint a partir de sus historias.
   * El progressPercent se basa en número de historias (no en puntos) para evitar
   * distorsiones cuando las historias grandes se completan al final.
   *
   * @param sprintId - ID del sprint
   * @returns Objeto con métricas de progreso
   */
  async getStats(sprintId: string): Promise<SprintStats> {
    const stories = await this.db.userStory.findMany({ where: { sprintId } });
    const totalStories = stories.length;
    const completedStories = stories.filter((s) => s.status === 'DONE').length;
    const totalPoints = stories.reduce((sum, s) => sum + (s.points ?? 0), 0);
    const completedPoints = stories
      .filter((s) => s.status === 'DONE')
      .reduce((sum, s) => sum + (s.points ?? 0), 0);
    // Evitar división por cero cuando el sprint no tiene historias
    const progressPercent = totalStories === 0 ? 0 : Math.round((completedStories / totalStories) * 100);
    return { totalPoints, completedPoints, totalStories, completedStories, progressPercent };
  }

  /**
   * Crea un nuevo sprint en estado PLANNING para el proyecto indicado.
   * Las fechas de entrada son strings ISO y se convierten a Date para Prisma.
   *
   * @param userId - ID del usuario que crea el sprint (para verificar permisos)
   * @param input  - Datos del sprint (nombre, goal, fechas opcionales)
   * @returns Sprint creado
   * @throws ForbiddenError si el usuario no tiene rol adecuado
   */
  async createSprint(
    userId: string,
    input: { name: string; goal?: string; projectId: string; startDate?: string; endDate?: string },
  ): Promise<Sprint> {
    await this.checkCanManage(userId, input.projectId);
    return this.repo.create({
      ...input,
      // Convertir string ISO a objeto Date que Prisma espera
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
    });
  }

  /**
   * Inicia un sprint, cambiando su estado de PLANNING a ACTIVE.
   *
   * Validaciones previas al inicio:
   * 1. El sprint debe existir y estar en PLANNING.
   * 2. No puede haber otro sprint activo en el mismo proyecto.
   *
   * Tras el inicio, notifica por email a todos los miembros del equipo
   * de forma asíncrona (fire-and-forget) para no bloquear la respuesta.
   *
   * @param userId - ID del usuario que inicia el sprint
   * @param id     - ID del sprint a iniciar
   * @param input  - Fechas definitivas y goal final del sprint
   * @returns Sprint actualizado con status ACTIVE
   * @throws ValidationError si el estado no permite la transición
   * @throws ValidationError si ya hay un sprint activo
   */
  async startSprint(
    userId: string,
    id: string,
    input: { goal?: string; startDate: string; endDate: string },
  ): Promise<Sprint> {
    const sprint = await this.repo.findById(id);
    if (!sprint) throw new NotFoundError('Sprint');
    await this.checkCanManage(userId, sprint.projectId);

    // Solo los sprints en planificación pueden iniciarse
    if (sprint.status !== 'PLANNING') {
      throw new ValidationError('Solo se pueden iniciar sprints en estado PLANNING');
    }

    // Regla Scrum: un proyecto solo puede tener un sprint activo a la vez
    const active = await this.repo.findActive(sprint.projectId);
    if (active) {
      throw new ValidationError('Ya hay un sprint activo en este proyecto');
    }

    const updatedSprint = await this.repo.update(id, {
      goal: input.goal,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      status: 'ACTIVE',
    });

    // Fire-and-forget: email all team members about sprint start
    this.notifySprintStarted(sprint.projectId, updatedSprint.name, updatedSprint.goal ?? '').catch(
      (err) => logger.error({ err }, 'Error sending sprint-started emails'),
    );

    return updatedSprint;
  }

  /**
   * Envía emails de notificación de inicio de sprint a todos los miembros del equipo.
   * Se ejecuta de forma asíncrona; los errores individuales de email se registran
   * en el log pero no interrumpen la operación completa.
   *
   * @param projectId - ID del proyecto (para obtener los miembros)
   * @param sprintName - Nombre del sprint iniciado
   * @param goal       - Goal definido para el sprint
   */
  private async notifySprintStarted(projectId: string, sprintName: string, goal: string) {
    const project = await this.db.project.findUnique({
      where: { id: projectId },
      // Incluir la cadena team → members → user para obtener emails
      include: { team: { include: { members: { include: { user: true } } } } },
    });
    if (!project) return;
    for (const member of project.team.members) {
      await emailService
        .sendSprintStartedEmail(member.user.email, member.user.name, sprintName, goal, project.name)
        .catch((err) => logger.error({ err }, `Error emailing sprint start to ${member.user.email}`));
    }
  }

  /**
   * Completa un sprint activo, cambiando su estado a COMPLETED.
   *
   * Proceso de cierre:
   * 1. Captura los puntos totales planificados ANTES de mover historias,
   *    para que el reporte de velocidad sea históricamente preciso.
   * 2. Mueve las historias incompletas al sprint destino o al backlog.
   * 3. Actualiza el estado a COMPLETED y persiste los puntos planificados.
   *
   * @param userId                   - ID del usuario que cierra el sprint
   * @param id                       - ID del sprint a completar
   * @param moveIncompleteToSprintId - Sprint destino (null/undefined → backlog)
   * @returns Sprint actualizado con status COMPLETED
   * @throws ValidationError si el sprint no está activo
   */
  async completeSprint(
    userId: string,
    id: string,
    moveIncompleteToSprintId?: string,
  ): Promise<Sprint> {
    const sprint = await this.repo.findById(id);
    if (!sprint) throw new NotFoundError('Sprint');
    await this.checkCanManage(userId, sprint.projectId);

    if (sprint.status !== 'ACTIVE') {
      throw new ValidationError('Solo se pueden completar sprints activos');
    }

    // Capture total planned points BEFORE moving stories (so reports stay accurate)
    const allStories = await this.db.userStory.findMany({ where: { sprintId: id } });
    const plannedPoints = allStories.reduce((sum, s) => sum + (s.points ?? 0), 0);

    // Move incomplete stories to another sprint or back to backlog
    const incompleteIds = allStories
      .filter((s) => s.status !== 'DONE')
      .map((s) => s.id);

    if (incompleteIds.length > 0) {
      // null significa backlog (sin sprint asignado)
      await this.db.userStory.updateMany({
        where: { id: { in: incompleteIds } },
        data: { sprintId: moveIncompleteToSprintId ?? null },
      });
    }

    return this.repo.update(id, { status: 'COMPLETED', plannedPoints });
  }

  /**
   * Elimina un sprint que no esté activo (PLANNING o COMPLETED).
   * Antes de eliminar, devuelve todas las historias del sprint al backlog
   * para preservar el trabajo registrado.
   *
   * @param userId - ID del usuario que solicita la eliminación
   * @param id     - ID del sprint a eliminar
   * @returns true si se eliminó correctamente
   * @throws ValidationError si el sprint está activo
   */
  async deleteSprint(userId: string, id: string): Promise<boolean> {
    const sprint = await this.repo.findById(id);
    if (!sprint) throw new NotFoundError('Sprint');
    await this.checkCanManage(userId, sprint.projectId);

    // No permitir eliminar un sprint en curso para no perder datos de velocidad
    if (sprint.status === 'ACTIVE') {
      throw new ValidationError('No se puede eliminar un sprint activo');
    }

    // Move stories back to backlog
    await this.db.userStory.updateMany({
      where: { sprintId: id },
      data: { sprintId: null },
    });

    await this.repo.delete(id);
    return true;
  }

  /**
   * Verifica que el usuario sea miembro del proyecto y tenga rol
   * PRODUCT_OWNER o SCRUM_MASTER, que son los únicos autorizados a
   * gestionar el ciclo de vida de los sprints en Scrum.
   *
   * @param userId    - ID del usuario a verificar
   * @param projectId - ID del proyecto
   * @throws NotFoundError si el proyecto no existe
   * @throws ForbiddenError si el usuario no es miembro o no tiene el rol adecuado
   */
  private async checkCanManage(userId: string, projectId: string): Promise<void> {
    const project = await this.db.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundError('Proyecto');
    const member = await this.db.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId: project.teamId } },
    });
    if (!member) throw new ForbiddenError('No eres miembro de este proyecto');
    if (!['PRODUCT_OWNER', 'SCRUM_MASTER'].includes(member.role)) {
      throw new ForbiddenError('Solo Product Owners y Scrum Masters pueden gestionar sprints');
    }
  }
}
