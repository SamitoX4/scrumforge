/**
 * @file task.resolver.ts
 * @module task
 * @description Resolvers de GraphQL para el módulo de tareas.
 *
 * Las tareas son las unidades de trabajo más granulares del sistema,
 * pertenecen a una historia de usuario y pueden ser asignadas a miembros.
 *
 * El servicio se instancia por request combinando el repositorio de tareas
 * con el cliente Prisma directo (necesario para la verificación de membresía).
 *
 * El resolver de campo `assignee` carga el usuario asignado de forma lazy
 * (solo si el cliente solicita ese campo), retornando null si no hay asignación.
 */

import { GraphQLContext } from '../../graphql/context';
import { TaskService } from './task.service';
import { TaskRepository } from './task.repository';
import { requireAuth } from '../../middleware/auth.middleware';

/**
 * Construye el árbol de dependencias del módulo de tareas.
 * Se pasan tanto el repositorio como el cliente Prisma al servicio porque
 * el servicio necesita acceder a otras tablas (UserStory, Project, TeamMember)
 * para la validación de membresía.
 *
 * @param context - Contexto GraphQL de la petición.
 * @returns Nueva instancia de TaskService.
 */
function makeService(context: GraphQLContext) {
  return new TaskService(new TaskRepository(context.prisma), context.prisma);
}

/**
 * Mapa de resolvers para el módulo de tareas.
 */
export const taskResolvers = {
  Query: {
    /**
     * Retorna todas las tareas de una historia de usuario,
     * ordenadas por el campo `order`.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param userStoryId - ID de la historia de usuario.
     * @param context - Contexto GraphQL con usuario autenticado.
     * @returns Lista de tareas de la historia.
     */
    async tasks(_: unknown, { userStoryId }: { userStoryId: string }, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).getTasks(userStoryId);
    },

    /**
     * Retorna una tarea específica por su ID.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param id - ID de la tarea.
     * @param context - Contexto GraphQL con usuario autenticado.
     * @returns La tarea encontrada.
     * @throws NotFoundError si la tarea no existe.
     */
    async task(_: unknown, { id }: { id: string }, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).getTask(id);
    },
  },

  Mutation: {
    /**
     * Crea una nueva tarea en una historia de usuario.
     * Verifica que el usuario autenticado sea miembro del proyecto
     * al que pertenece la historia antes de crear la tarea.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param input - Datos de la nueva tarea.
     * @param context - Contexto GraphQL con usuario autenticado.
     * @returns La tarea recién creada.
     */
    async createTask(
      _: unknown,
      { input }: { input: { title: string; description?: string; userStoryId: string; assigneeId?: string; dueDate?: string } },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).createTask(context.user.id, input);
    },

    /**
     * Actualiza los campos de una tarea existente.
     * Solo el usuario miembro del proyecto puede actualizar tareas.
     * El tipo del parámetro `input` se castea al tipo esperado por el servicio.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param id - ID de la tarea a actualizar.
     * @param input - Campos a modificar (todos opcionales).
     * @param context - Contexto GraphQL con usuario autenticado.
     * @returns La tarea actualizada.
     */
    async updateTask(
      _: unknown,
      { id, input }: { id: string; input: Record<string, unknown> },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      // Se castea el input genérico al tipo específico que espera el servicio
      return makeService(context).updateTask(context.user.id, id, input as Parameters<TaskService['updateTask']>[2]);
    },

    /**
     * Elimina una tarea verificando membresía del usuario en el proyecto.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param id - ID de la tarea a eliminar.
     * @param context - Contexto GraphQL con usuario autenticado.
     * @returns `true` si la eliminación fue exitosa.
     */
    async deleteTask(_: unknown, { id }: { id: string }, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).deleteTask(context.user.id, id);
    },
  },

  /**
   * Resolvers de campo del tipo `Task`.
   */
  Task: {
    /**
     * Resuelve el campo `assignee` cargando el usuario asignado desde la BD.
     * Retorna null inmediatamente si no hay asignación (`assigneeId` es null),
     * evitando una consulta innecesaria a la base de datos.
     *
     * @param parent - Objeto Task con `assigneeId`.
     * @param _ - Argumentos del campo; no utilizados.
     * @param prisma - Cliente Prisma del contexto.
     * @returns El usuario asignado o null.
     */
    async assignee(parent: { assigneeId: string | null }, _: unknown, { prisma }: GraphQLContext) {
      // Cortocircuito: si no hay asignación, no se hace consulta a BD
      if (!parent.assigneeId) return null;
      return prisma.user.findUnique({ where: { id: parent.assigneeId } });
    },
  },
};
