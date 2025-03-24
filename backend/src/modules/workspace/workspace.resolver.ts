/**
 * @file workspace.resolver.ts
 * @description Resolvers GraphQL del módulo de workspaces.
 *
 * Cada resolver construye su propio `WorkspaceService` a través de `makeService`,
 * inyectando el cliente Prisma desde el contexto de Apollo. Este patrón garantiza
 * aislamiento por petición y facilita los tests unitarios.
 *
 * Todos los resolvers exigen autenticación mediante `requireAuth`. El campo
 * `Workspace.planLimits` se resuelve de forma perezosa (lazy) para no penalizar
 * las consultas que no lo necesiten.
 */
import { GraphQLContext } from '../../graphql/context';
import { WorkspaceService } from './workspace.service';
import { WorkspaceRepository } from './workspace.repository';
import { PlanService } from '../../services/plan.service';
import { requireAuth } from '../../middleware/auth.middleware';

/**
 * Factoría que construye un `WorkspaceService` listo para usar con el contexto
 * de la petición actual. Se llama en cada resolver para garantizar que el
 * repositorio usa siempre el cliente Prisma correcto.
 *
 * @param context - Contexto GraphQL de Apollo con el cliente Prisma y el usuario autenticado.
 * @returns Instancia de `WorkspaceService` configurada para esta petición.
 */
function makeService(context: GraphQLContext) {
  return new WorkspaceService(new WorkspaceRepository(context.prisma), context.prisma);
}

export const workspaceResolvers = {
  Query: {
    /**
     * Devuelve todos los workspaces accesibles para el usuario autenticado,
     * incluyendo los que posee y los de equipos en los que participa.
     *
     * @param _ - Objeto padre (no aplica en queries raíz).
     * @param __ - Sin argumentos.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async workspaces(_: unknown, __: unknown, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).getWorkspaces(context.user.id);
    },

    /**
     * Devuelve un workspace por su ID.
     *
     * @param _ - Objeto padre (no aplica en queries raíz).
     * @param id - ID único del workspace.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async workspace(_: unknown, { id }: { id: string }, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).getWorkspace(id);
    },

    /**
     * Devuelve un workspace por su slug URL-friendly.
     * Útil para construir URLs legibles del tipo `/ws/mi-empresa`.
     *
     * @param _ - Objeto padre (no aplica en queries raíz).
     * @param slug - Slug único del workspace.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async workspaceBySlug(_: unknown, { slug }: { slug: string }, context: GraphQLContext) {
      requireAuth(context);
      return makeService(context).getWorkspaceBySlug(slug);
    },
  },

  Mutation: {
    /**
     * Crea un nuevo workspace con el usuario autenticado como propietario.
     * Adicionalmente crea un equipo "General" y suscripción al plan gratuito.
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param input - Nombre y slug del nuevo workspace.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async createWorkspace(
      _: unknown,
      { input }: { input: { name: string; slug: string } },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).createWorkspace(context.user.id, input);
    },

    /**
     * Actualiza el nombre de un workspace existente.
     * Solo el propietario del workspace puede modificarlo.
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param id - ID del workspace a actualizar.
     * @param input - Nuevo nombre del workspace.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async updateWorkspace(
      _: unknown,
      { id, input }: { id: string; input: { name: string } },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).updateWorkspace(id, context.user.id, input);
    },

    /**
     * Elimina un workspace y todos sus datos en cascada (equipos, proyectos, etc.).
     * Solo el propietario del workspace puede eliminarlo.
     *
     * @param _ - Objeto padre (no aplica en mutations raíz).
     * @param id - ID del workspace a eliminar.
     * @param context - Contexto GraphQL con usuario autenticado.
     */
    async deleteWorkspace(
      _: unknown,
      { id }: { id: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).deleteWorkspace(id, context.user.id);
    },
  },

  Workspace: {
    /**
     * Resuelve los equipos pertenecientes al workspace.
     * Se ejecuta de forma perezosa: solo cuando el cliente solicita el campo `teams`.
     *
     * @param parent - Workspace padre resuelto en el nivel superior.
     * @param _ - Sin argumentos adicionales.
     * @param prisma - Cliente Prisma del contexto de Apollo.
     */
    async teams(parent: { id: string }, _: unknown, { prisma }: GraphQLContext) {
      return prisma.team.findMany({ where: { workspaceId: parent.id } });
    },

    /**
     * Resuelve los límites del plan activo del workspace.
     * Se consulta de forma perezosa para no penalizar queries que no lo necesiten.
     * Devuelve un objeto JSON con las restricciones del plan (máx. proyectos, features, etc.).
     *
     * @param parent - Workspace padre resuelto en el nivel superior.
     * @param _ - Sin argumentos adicionales.
     * @param prisma - Cliente Prisma del contexto de Apollo.
     */
    async planLimits(parent: { id: string }, _: unknown, { prisma }: GraphQLContext) {
      const planService = new PlanService(prisma);
      const { limits } = await planService.getWorkspacePlan(parent.id);
      return limits;
    },
  },
};
