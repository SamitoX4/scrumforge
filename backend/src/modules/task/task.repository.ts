/**
 * @file task.repository.ts
 * @module task
 * @description Repositorio de acceso a datos para la entidad `Task`.
 *
 * Una tarea es la unidad de trabajo más granular dentro de una historia
 * de usuario. El repositorio gestiona el orden automático al crear tareas
 * y expone operaciones CRUD estándar.
 *
 * El campo `order` se calcula automáticamente en `create` consultando
 * la tarea con mayor orden de la misma historia y sumando 1.
 */

import { PrismaClient, Task } from '@prisma/client';

/**
 * @class TaskRepository
 * @description Provee operaciones CRUD para la entidad `Task`.
 * Recibe el cliente Prisma por inyección para facilitar pruebas unitarias.
 */
export class TaskRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Busca una tarea por su identificador único.
   * Usada para verificar existencia y obtener datos antes de operaciones
   * de actualización o eliminación.
   *
   * @param id - ID de la tarea.
   * @returns La tarea encontrada o null.
   */
  async findById(id: string): Promise<Task | null> {
    return this.db.task.findUnique({ where: { id } });
  }

  /**
   * Retorna todas las tareas de una historia de usuario,
   * ordenadas por el campo `order` ascendente para mostrarlas
   * en el orden visual configurado por el equipo.
   *
   * @param userStoryId - ID de la historia de usuario.
   * @returns Lista de tareas ordenadas ascendentemente.
   */
  async findByStory(userStoryId: string): Promise<Task[]> {
    return this.db.task.findMany({
      where: { userStoryId },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Crea una nueva tarea al final de la lista de la historia.
   * Para calcular el orden, se consulta la tarea con el mayor `order`
   * en la misma historia y se le suma 1. Si no hay tareas previas, comienza en 0.
   *
   * @param data - Datos de la nueva tarea.
   * @param data.title - Título de la tarea.
   * @param data.description - Descripción opcional.
   * @param data.userStoryId - Historia a la que pertenece.
   * @param data.assigneeId - ID del usuario asignado (opcional).
   * @param data.dueDate - Fecha límite (opcional).
   * @returns La tarea recién creada con su orden asignado.
   */
  async create(data: {
    title: string;
    description?: string;
    userStoryId: string;
    assigneeId?: string;
    dueDate?: Date;
  }): Promise<Task> {
    // Se busca la tarea con mayor orden para calcular el siguiente
    const last = await this.db.task.findFirst({
      where: { userStoryId: data.userStoryId },
      orderBy: { order: 'desc' },
    });
    return this.db.task.create({
      // Si no hay tareas previas, last es null y se usa -1 para obtener orden 0
      data: { ...data, order: (last?.order ?? -1) + 1 },
    });
  }

  /**
   * Actualiza parcialmente una tarea existente.
   * Solo se modifican los campos que estén presentes en `data`;
   * los campos ausentes mantienen su valor actual en la base de datos.
   *
   * @param id - ID de la tarea a actualizar.
   * @param data - Campos a actualizar (todos opcionales).
   * @returns La tarea con los datos actualizados.
   */
  async update(
    id: string,
    data: {
      title?: string;
      description?: string;
      status?: string;
      assigneeId?: string | null;  // null para desasignar explícitamente
      dueDate?: Date | null;        // null para eliminar la fecha límite
      order?: number;
    },
  ): Promise<Task> {
    return this.db.task.update({ where: { id }, data });
  }

  /**
   * Elimina una tarea de la base de datos.
   * La verificación de permisos se realiza en el servicio antes de llamar aquí.
   *
   * @param id - ID de la tarea a eliminar.
   */
  async delete(id: string): Promise<void> {
    await this.db.task.delete({ where: { id } });
  }
}
