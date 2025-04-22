/**
 * @file task.service.ts
 * @module task
 * @description Servicio de lógica de negocio para tareas.
 *
 * Implementa las reglas de negocio y control de acceso para operaciones
 * sobre tareas. La verificación de membresía (`checkMembership`) asegura
 * que solo miembros del proyecto puedan crear, modificar o eliminar tareas.
 *
 * La verificación navega: Tarea → Historia → Proyecto → Equipo → Membresía,
 * garantizando que el usuario pertenezca al equipo del proyecto.
 *
 * La conversión de `dueDate` de string ISO a objeto `Date` se maneja
 * con tres casos: string → Date, null → null (borrar fecha), undefined → sin cambio.
 */

import { Task, PrismaClient } from '@prisma/client';
import { TaskRepository } from './task.repository';
import { ForbiddenError, NotFoundError } from '../../utils/error.utils';

/**
 * @class TaskService
 * @description Orquesta las operaciones sobre tareas con validaciones
 * de existencia, control de acceso y conversión de tipos.
 */
export class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly db: PrismaClient, // Se necesita para acceder a otras tablas en checkMembership
  ) {}

  /**
   * Retorna todas las tareas de una historia de usuario.
   *
   * @param userStoryId - ID de la historia de usuario.
   * @returns Lista de tareas ordenada por `order` ascendente.
   */
  async getTasks(userStoryId: string): Promise<Task[]> {
    return this.repo.findByStory(userStoryId);
  }

  /**
   * Retorna una tarea específica verificando su existencia.
   *
   * @param id - ID de la tarea.
   * @returns La tarea encontrada.
   * @throws NotFoundError si la tarea no existe.
   */
  async getTask(id: string): Promise<Task> {
    const task = await this.repo.findById(id);
    if (!task) throw new NotFoundError('Tarea');
    return task;
  }

  /**
   * Crea una nueva tarea en una historia de usuario tras verificar membresía.
   * La fecha límite se convierte de string ISO a Date si está presente.
   *
   * @param userId - ID del usuario que crea la tarea (debe ser miembro del proyecto).
   * @param input - Datos de la tarea a crear.
   * @returns La tarea creada con orden asignado automáticamente.
   * @throws ForbiddenError si el usuario no es miembro del proyecto.
   */
  async createTask(
    userId: string,
    input: {
      title: string;
      description?: string;
      userStoryId: string;
      assigneeId?: string;
      dueDate?: string;
    },
  ): Promise<Task> {
    // Verificar que el usuario pertenece al proyecto antes de crear
    await this.checkMembership(userId, input.userStoryId);
    return this.repo.create({
      ...input,
      // Conversión de string ISO a Date; undefined si no se proporcionó fecha
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
    });
  }

  /**
   * Actualiza los campos de una tarea existente.
   * Maneja tres casos para `dueDate`:
   * - string → se convierte a Date.
   * - null → se borra la fecha (asigna null en BD).
   * - undefined → no se modifica el campo actual.
   *
   * @param userId - ID del usuario que actualiza (debe ser miembro del proyecto).
   * @param id - ID de la tarea a actualizar.
   * @param data - Campos a modificar con sus nuevos valores.
   * @returns La tarea actualizada.
   * @throws NotFoundError si la tarea no existe.
   * @throws ForbiddenError si el usuario no es miembro del proyecto.
   */
  async updateTask(
    userId: string,
    id: string,
    data: {
      title?: string;
      description?: string;
      status?: string;
      assigneeId?: string | null;
      dueDate?: string | null;
      order?: number;
    },
  ): Promise<Task> {
    const task = await this.repo.findById(id);
    if (!task) throw new NotFoundError('Tarea');
    await this.checkMembership(userId, task.userStoryId);
    return this.repo.update(id, {
      ...data,
      // Lógica de tres estados para dueDate:
      // string -> new Date(string) | null -> null | undefined -> undefined (sin cambio)
      dueDate: data.dueDate ? new Date(data.dueDate) : data.dueDate === null ? null : undefined,
    });
  }

  /**
   * Elimina una tarea verificando su existencia y la membresía del usuario.
   *
   * @param userId - ID del usuario que elimina (debe ser miembro del proyecto).
   * @param id - ID de la tarea a eliminar.
   * @returns `true` si la eliminación fue exitosa.
   * @throws NotFoundError si la tarea no existe.
   * @throws ForbiddenError si el usuario no es miembro del proyecto.
   */
  async deleteTask(userId: string, id: string): Promise<boolean> {
    const task = await this.repo.findById(id);
    if (!task) throw new NotFoundError('Tarea');
    await this.checkMembership(userId, task.userStoryId);
    await this.repo.delete(id);
    return true;
  }

  /**
   * Verifica que un usuario sea miembro del equipo del proyecto al que
   * pertenece una historia de usuario.
   *
   * La cadena de verificación es:
   * UserStory (id) → Project (projectId) → Team (teamId) → TeamMember (userId + teamId)
   *
   * @param userId - ID del usuario a verificar.
   * @param userStoryId - ID de la historia de usuario de la que se navega al proyecto.
   * @throws NotFoundError si la historia o el proyecto no existen.
   * @throws ForbiddenError si el usuario no pertenece al equipo del proyecto.
   */
  private async checkMembership(userId: string, userStoryId: string): Promise<void> {
    // Paso 1: obtener la historia para acceder al projectId
    const story = await this.db.userStory.findUnique({ where: { id: userStoryId } });
    if (!story) throw new NotFoundError('Historia de usuario');

    // Paso 2: obtener el proyecto para acceder al teamId
    const project = await this.db.project.findUnique({ where: { id: story.projectId } });
    if (!project) throw new NotFoundError('Proyecto');

    // Paso 3: verificar membresía usando la clave compuesta userId_teamId
    const member = await this.db.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId: project.teamId } },
    });
    if (!member) throw new ForbiddenError('No eres miembro de este proyecto');
  }
}
