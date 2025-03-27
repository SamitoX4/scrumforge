/**
 * @file team.resolver.ts
 * @description Resolvers GraphQL del módulo de equipos.
 *
 * Cada resolver construye su propio `TeamService` a través de `makeService`
 * para garantizar aislamiento por petición. Todos los resolvers exigen
 * autenticación mediante `requireAuth`.
 *
 * Los campos del tipo `Team` (`members`, `projects`) y `TeamMember` (`user`)
 * se resuelven de forma perezosa: Apollo solo los ejecuta cuando el cliente
 * los solicita explícitamente en la query.
 */
import { GraphQLContext } from '../../graphql/context';
import { TeamService } from './team.service';
import { TeamRepository } from './team.repository';
import { requireAuth } from '../../middleware/auth.middleware';

/**
 * Factoría que construye un `TeamService` listo para usar con el contexto
 * de la petición actual. Combina repositorio y cliente Prisma en una sola llamada.
 *
 * @param context - Contexto GraphQL de Apollo con el cliente Prisma y el usuario autenticado.
 * @returns Instancia de `TeamService` configurada para esta petición.
 */
function makeService(context: GraphQLContext) {
  return new TeamService(new TeamRepository(context.prisma), context.prisma);
}

export const teamResolvers = {
  Query: {
    /**
     * Devuelve un equipo por su ID.
     *
     * @param _ - Objeto padre (no aplica en queries raíz).
     * @param id - ID del equipo.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async team(_: unknown, { id }: { id: string }, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).getTeam(id);
    },

    /**
     * Devuelve los equipos del workspace en los que participa el usuario autenticado.
     *
     * @param _ - Objeto padre (no aplica en queries raíz).
     * @param workspaceId - ID del workspace donde buscar los equipos del usuario.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async myTeams(
      _: unknown,
      { workspaceId }: { workspaceId: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).getMyTeams(context.user.id, workspaceId);
    },
  },

  Mutation: {
    /**
     * Crea un nuevo equipo en el workspace indicado.
     * El creador se añade automáticamente como SCRUM_MASTER.
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param input - Nombre del equipo e ID del workspace.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async createTeam(
      _: unknown,
      { input }: { input: { name: string; workspaceId: string } },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).createTeam(context.user.id, input);
    },

    /**
     * Elimina a un usuario del equipo.
     * Solo PRODUCT_OWNER y SCRUM_MASTER pueden ejecutar esta acción.
     * No se puede eliminar al último PRODUCT_OWNER del equipo.
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param teamId - ID del equipo.
     * @param userId - ID del usuario a eliminar del equipo.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async removeMember(
      _: unknown,
      { teamId, userId }: { teamId: string; userId: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).removeMember(context.user.id, teamId, userId);
    },

    /**
     * Cambia el rol de un miembro del equipo.
     * Solo PRODUCT_OWNER y SCRUM_MASTER pueden ejecutar esta acción.
     * No se puede degradar al último PRODUCT_OWNER del equipo.
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param teamId - ID del equipo.
     * @param userId - ID del usuario cuyo rol se cambia.
     * @param role   - Nuevo rol a asignar.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async updateMemberRole(
      _: unknown,
      { teamId, userId, role }: { teamId: string; userId: string; role: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).updateMemberRole(context.user.id, teamId, userId, role);
    },
  },

  Team: {
    /**
     * Resuelve los miembros del equipo de forma perezosa.
     *
     * @param parent - Equipo padre resuelto en el nivel superior.
     * @param _ - Sin argumentos adicionales.
     * @param prisma - Cliente Prisma del contexto de Apollo.
     */
    async members(parent: { id: string }, _: unknown, { prisma }: GraphQLContext) {
      return prisma.teamMember.findMany({ where: { teamId: parent.id } });
    },

    /**
     * Resuelve los proyectos del equipo de forma perezosa.
     *
     * @param parent - Equipo padre resuelto en el nivel superior.
     * @param _ - Sin argumentos adicionales.
     * @param prisma - Cliente Prisma del contexto de Apollo.
     */
    async projects(parent: { id: string }, _: unknown, { prisma }: GraphQLContext) {
      return prisma.project.findMany({ where: { teamId: parent.id } });
    },
  },

  TeamMember: {
    /**
     * Resuelve el usuario asociado al registro de membresía.
     * Permite al cliente obtener datos del usuario (nombre, avatar) junto con su rol.
     *
     * @param parent - TeamMember padre resuelto en el nivel superior.
     * @param _ - Sin argumentos adicionales.
     * @param prisma - Cliente Prisma del contexto de Apollo.
     */
    async user(parent: { userId: string }, _: unknown, { prisma }: GraphQLContext) {
      return prisma.user.findUnique({ where: { id: parent.userId } });
    },
  },
};
