/**
 * @file project.resolver.ts
 * @description Resolvers GraphQL del módulo de proyectos.
 *
 * Cada resolver construye su propio `ProjectService` a través de `makeService`
 * para garantizar aislamiento por petición. Todos los resolvers exigen
 * autenticación mediante `requireAuth`.
 *
 * Los campos del tipo `Project` (`team`, `epics`, `sprints`) se resuelven de
 * forma perezosa: Apollo solo los ejecuta cuando el cliente los solicita
 * explícitamente en la query.
 */
import { GraphQLContext } from '../../graphql/context';
import { ProjectService } from './project.service';
import { ProjectRepository } from './project.repository';
import { requireAuth } from '../../middleware/auth.middleware';

/**
 * Factoría que construye un `ProjectService` listo para usar con el contexto
 * de la petición actual. Combina repositorio y cliente Prisma en una sola llamada.
 *
 * @param context - Contexto GraphQL de Apollo con el cliente Prisma y el usuario autenticado.
 * @returns Instancia de `ProjectService` configurada para esta petición.
 */
function makeService(context: GraphQLContext) {
  return new ProjectService(new ProjectRepository(context.prisma), context.prisma);
}

export const projectResolvers = {
  Query: {
    /**
     * Devuelve un proyecto por su ID.
     *
     * @param _ - Objeto padre (no aplica en queries raíz).
     * @param id - ID del proyecto.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async project(_: unknown, { id }: { id: string }, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).getProject(id);
    },

    /**
     * Devuelve todos los proyectos de un equipo.
     *
     * @param _ - Objeto padre (no aplica en queries raíz).
     * @param teamId - ID del equipo cuyos proyectos se quieren listar.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async projects(_: unknown, { teamId }: { teamId: string }, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).getProjects(teamId);
    },
  },

  Mutation: {
    /**
     * Crea un nuevo proyecto dentro de un equipo.
     * Solo los miembros con rol PRODUCT_OWNER o SCRUM_MASTER pueden crear proyectos.
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param input - Nombre, clave y equipo del nuevo proyecto.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async createProject(
      _: unknown,
      { input }: { input: { name: string; key: string; teamId: string } },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).createProject(context.user.id, input);
    },

    /**
     * Actualiza el nombre y/o la configuración de un proyecto existente.
     * Solo los miembros con rol PRODUCT_OWNER o SCRUM_MASTER pueden actualizar proyectos.
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param id - ID del proyecto a actualizar.
     * @param name - Nuevo nombre opcional.
     * @param settings - Nuevo JSON de configuración opcional.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async updateProject(
      _: unknown,
      { id, name, settings }: { id: string; name?: string; settings?: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).updateProject(context.user.id, id, { name, settings });
    },

    /**
     * Elimina un proyecto y todos sus datos en cascada (épicas, historias, sprints).
     * Solo los miembros con rol PRODUCT_OWNER o SCRUM_MASTER pueden eliminar proyectos.
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param id - ID del proyecto a eliminar.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async deleteProject(_: unknown, { id }: { id: string }, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).deleteProject(context.user.id, id);
    },
  },

  Project: {
    /**
     * Resuelve el equipo al que pertenece el proyecto.
     * Se ejecuta de forma perezosa: solo cuando el cliente solicita el campo `team`.
     *
     * @param parent - Proyecto padre resuelto en el nivel superior.
     * @param _ - Sin argumentos adicionales.
     * @param prisma - Cliente Prisma del contexto de Apollo.
     */
    async team(parent: { teamId: string }, _: unknown, { prisma }: GraphQLContext) {
      return prisma.team.findUnique({ where: { id: parent.teamId } });
    },

    /**
     * Resuelve las épicas del proyecto ordenadas por `order` ascendente.
     * El orden garantiza que la UI muestre las épicas en la secuencia definida por el PO.
     *
     * @param parent - Proyecto padre resuelto en el nivel superior.
     * @param _ - Sin argumentos adicionales.
     * @param prisma - Cliente Prisma del contexto de Apollo.
     */
    async epics(parent: { id: string }, _: unknown, { prisma }: GraphQLContext) {
      return prisma.epic.findMany({ where: { projectId: parent.id }, orderBy: { order: 'asc' } });
    },

    /**
     * Resuelve los sprints del proyecto ordenados por fecha de creación descendente
     * (el sprint más reciente aparece primero).
     *
     * @param parent - Proyecto padre resuelto en el nivel superior.
     * @param _ - Sin argumentos adicionales.
     * @param prisma - Cliente Prisma del contexto de Apollo.
     */
    async sprints(parent: { id: string }, _: unknown, { prisma }: GraphQLContext) {
      return prisma.sprint.findMany({ where: { projectId: parent.id }, orderBy: { createdAt: 'desc' } });
    },
  },
};
