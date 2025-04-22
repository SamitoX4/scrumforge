/**
 * @file comment.types.ts
 * @description Tipos TypeScript compartidos para el módulo de comentarios.
 * Define las estructuras de entrada usadas por el resolver y el servicio
 * de comentarios.
 */

/**
 * Datos de entrada para crear un nuevo comentario.
 * Un comentario debe estar asociado a al menos uno de los dos contextos
 * posibles: una historia de usuario o una tarea. Si se omiten ambos,
 * el servicio de comentarios deberá validar y rechazar la operación.
 */
export interface CreateCommentInput {
  /** Contenido textual del comentario. No debe estar vacío. */
  body: string;
  /** ID de la historia de usuario a la que pertenece el comentario, si aplica. */
  userStoryId?: string;
  /** ID de la tarea a la que pertenece el comentario, si aplica. */
  taskId?: string;
}
