/**
 * @file comment.service.ts
 * @module comment
 * @description Servicio de lógica de negocio para comentarios.
 *
 * Implementa las reglas de validación y autorización antes de
 * delegar las operaciones de persistencia al `CommentRepository`:
 * - Un comentario no puede estar vacío.
 * - Debe estar asociado a una historia o a una tarea.
 * - Solo el autor puede eliminar su propio comentario.
 */

import { Comment } from '@prisma/client';
import { CommentRepository } from './comment.repository';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/error.utils';

/**
 * @class CommentService
 * @description Orquesta las operaciones sobre comentarios aplicando
 * validaciones de negocio y control de acceso.
 */
export class CommentService {
  constructor(private readonly repo: CommentRepository) {}

  /**
   * Recupera los comentarios filtrados por historia o tarea.
   * Si no se proporciona ningún filtro se retorna una lista vacía
   * en lugar de lanzar un error, para simplificar el manejo en el cliente.
   *
   * @param filter - Objeto con `userStoryId` y/o `taskId`.
   * @returns Lista de comentarios correspondientes, o array vacío si no hay filtro.
   */
  async getComments(filter: { userStoryId?: string; taskId?: string }): Promise<Comment[]> {
    // Prioridad: primero se intenta por historia, luego por tarea
    if (filter.userStoryId) return this.repo.findByUserStory(filter.userStoryId);
    if (filter.taskId) return this.repo.findByTask(filter.taskId);
    return [];
  }

  /**
   * Crea un nuevo comentario tras validar las reglas de negocio.
   *
   * Validaciones:
   * 1. El cuerpo no puede ser una cadena vacía o de solo espacios.
   * 2. El comentario debe estar vinculado a una historia o a una tarea.
   *
   * @param userId - ID del usuario autor (obtenido del token JWT).
   * @param input - Datos del comentario a crear.
   * @param input.body - Texto del comentario.
   * @param input.userStoryId - Historia asociada (opcional).
   * @param input.taskId - Tarea asociada (opcional).
   * @returns El comentario creado con el cuerpo recortado de espacios.
   * @throws ValidationError si el cuerpo está vacío o falta asociación.
   */
  async addComment(
    userId: string,
    input: { body: string; userStoryId?: string; taskId?: string },
  ): Promise<Comment> {
    // El cuerpo no debe ser vacío ni contener solo espacios en blanco
    if (!input.body.trim()) {
      throw new ValidationError('El comentario no puede estar vacío');
    }

    // Un comentario debe estar asociado a una entidad (historia o tarea)
    if (!input.userStoryId && !input.taskId) {
      throw new ValidationError('El comentario debe estar asociado a una historia o tarea');
    }

    return this.repo.create({
      body: input.body.trim(), // Se limpia el texto antes de persistir
      authorId: userId,
      userStoryId: input.userStoryId,
      taskId: input.taskId,
    });
  }

  /**
   * Elimina un comentario verificando existencia y autorización.
   *
   * @param userId - ID del usuario que solicita la eliminación.
   * @param id - ID del comentario a eliminar.
   * @returns `true` si la eliminación fue exitosa.
   * @throws NotFoundError si el comentario no existe.
   * @throws ForbiddenError si el solicitante no es el autor del comentario.
   */
  async deleteComment(userId: string, id: string): Promise<boolean> {
    const comment = await this.repo.findById(id);

    // Se verifica existencia antes de comprobar autoría
    if (!comment) throw new NotFoundError('Comentario');

    // Solo el autor original tiene permiso de eliminar su comentario
    if (comment.authorId !== userId) {
      throw new ForbiddenError('Solo el autor puede eliminar su comentario');
    }

    await this.repo.delete(id);
    return true;
  }
}
