/**
 * @file comment.repository.ts
 * @module comment
 * @description Repositorio de acceso a datos para la entidad `Comment`.
 *
 * Centraliza todas las operaciones sobre la tabla `comment` de Prisma,
 * aislando la capa de persistencia de la lógica de negocio del servicio.
 * Los comentarios pueden estar asociados a una historia de usuario
 * (`userStoryId`) o a una tarea (`taskId`), pero nunca a ambas.
 */

import { Comment, PrismaClient } from '@prisma/client';

/**
 * @class CommentRepository
 * @description Provee métodos CRUD para la entidad `Comment`.
 * Recibe el cliente Prisma por inyección para facilitar pruebas unitarias.
 */
export class CommentRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Recupera todos los comentarios de una historia de usuario,
   * ordenados cronológicamente de más antiguo a más reciente
   * para presentarlos en orden de conversación.
   *
   * @param userStoryId - ID de la historia de usuario.
   * @returns Lista de comentarios ordenada por fecha de creación ascendente.
   */
  async findByUserStory(userStoryId: string): Promise<Comment[]> {
    return this.db.comment.findMany({
      where: { userStoryId },
      orderBy: { createdAt: 'asc' }, // Orden cronológico para lectura natural
    });
  }

  /**
   * Recupera todos los comentarios de una tarea específica,
   * ordenados de más antiguo a más reciente.
   *
   * @param taskId - ID de la tarea.
   * @returns Lista de comentarios de la tarea.
   */
  async findByTask(taskId: string): Promise<Comment[]> {
    return this.db.comment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Busca un comentario por su identificador único.
   * Se usa principalmente para verificar existencia y autoría antes
   * de permitir operaciones de edición o eliminación.
   *
   * @param id - ID del comentario.
   * @returns El comentario encontrado, o null si no existe.
   */
  async findById(id: string): Promise<Comment | null> {
    return this.db.comment.findUnique({ where: { id } });
  }

  /**
   * Crea un nuevo comentario en la base de datos.
   * Al menos uno de `userStoryId` o `taskId` debe estar presente;
   * esta restricción se valida en el servicio antes de llamar al repositorio.
   *
   * @param data - Datos del comentario a crear.
   * @param data.body - Texto del comentario (ya validado y saneado por el servicio).
   * @param data.authorId - ID del usuario autor.
   * @param data.userStoryId - ID de la historia asociada (opcional).
   * @param data.taskId - ID de la tarea asociada (opcional).
   * @returns El comentario recién creado.
   */
  async create(data: {
    body: string;
    authorId: string;
    userStoryId?: string;
    taskId?: string;
  }): Promise<Comment> {
    return this.db.comment.create({ data });
  }

  /**
   * Elimina un comentario por su ID.
   * La autorización (que el solicitante sea el autor) se verifica
   * en el servicio antes de invocar este método.
   *
   * @param id - ID del comentario a eliminar.
   */
  async delete(id: string): Promise<void> {
    await this.db.comment.delete({ where: { id } });
  }
}
