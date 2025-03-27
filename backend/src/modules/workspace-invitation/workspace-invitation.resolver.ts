/**
 * @file workspace-invitation.resolver.ts
 * @module workspace-invitation
 * @description Resolvers de GraphQL para el módulo de invitaciones a workspaces.
 *
 * Gestiona el flujo completo de invitaciones:
 * 1. `inviteMember`: el propietario/miembro envía una invitación por email.
 * 2. `acceptInvitation`: el invitado acepta usando el token del email.
 * 3. `revokeInvitation`: el propietario cancela una invitación pendiente.
 * 4. `pendingInvitations`: lista las invitaciones activas de un workspace.
 *
 * La mutación `revokeInvitation` requiere que el header `x-workspace-slug`
 * esté presente para obtener el `workspaceId` del contexto; de lo contrario
 * se lanza un `ForbiddenError`. Este diseño valida que la invitación
 * pertenece al workspace actual antes de eliminarla.
 */

import { GraphQLContext } from '../../graphql/context';
import { WorkspaceInvitationService } from './workspace-invitation.service';
import { requireAuth } from '../../middleware/auth.middleware';

/**
 * Instancia el servicio de invitaciones con el cliente Prisma del contexto.
 *
 * @param context - Contexto GraphQL de la petición.
 * @returns Nueva instancia de WorkspaceInvitationService.
 */
function makeService(context: GraphQLContext): WorkspaceInvitationService {
  return new WorkspaceInvitationService(context.prisma);
}

/**
 * Mapa de resolvers para el módulo de invitaciones a workspace.
 */
export const workspaceInvitationResolvers = {
  Query: {
    /**
     * Retorna las invitaciones pendientes (no aceptadas y no expiradas)
     * de un workspace específico.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param workspaceId - ID del workspace a consultar.
     * @param context - Contexto GraphQL con usuario autenticado.
     * @returns Lista de invitaciones pendientes ordenadas por fecha de creación.
     */
    async pendingInvitations(
      _: unknown,
      { workspaceId }: { workspaceId: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).getPendingInvitations(workspaceId);
    },
  },

  Mutation: {
    /**
     * Invita a un nuevo miembro al workspace enviándole un email con el token.
     * El usuario invitador debe ser propietario o miembro del workspace.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param workspaceId - ID del workspace al que se invita.
     * @param email - Correo del usuario a invitar.
     * @param role - Rol que tendrá el usuario en el workspace (p.ej. DEVELOPER).
     * @param context - Contexto GraphQL con usuario autenticado.
     * @returns La invitación creada con el token y la fecha de expiración.
     */
    async inviteMember(
      _: unknown,
      { workspaceId, email, role }: { workspaceId: string; email: string; role: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).inviteMember(workspaceId, context.user.id, email, role);
    },

    /**
     * Acepta una invitación pendiente usando el token recibido por email.
     * Si el usuario ya era miembro del equipo, no se crea una segunda membresía.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param token - Token de invitación del enlace del email.
     * @param context - Contexto GraphQL con usuario autenticado.
     * @returns `true` si la aceptación fue exitosa.
     */
    async acceptInvitation(
      _: unknown,
      { token }: { token: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);
      return makeService(context).acceptInvitation(token, context.user.id);
    },

    /**
     * Revoca (cancela) una invitación pendiente de un workspace.
     * Requiere que el header `x-workspace-slug` esté presente en la petición
     * para resolver el `workspaceId` del contexto. Esto evita que un usuario
     * pueda revocar invitaciones de otros workspaces.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param invitationId - ID de la invitación a revocar.
     * @param context - Contexto GraphQL con usuario autenticado y workspaceId.
     * @returns `true` si la revocación fue exitosa.
     * @throws ForbiddenError si no se proporcionó el header x-workspace-slug.
     */
    async revokeInvitation(
      _: unknown,
      { invitationId }: { invitationId: string },
      context: GraphQLContext,
    ) {
      requireAuth(context);

      // El workspaceId proviene del header x-workspace-slug resuelto en el contexto
      const workspaceId = context.workspaceId;
      if (!workspaceId) {
        // Import dinámico para evitar dependencias circulares en el módulo
        const { ForbiddenError } = await import('../../utils/error.utils');
        throw new ForbiddenError('Se requiere contexto de workspace (header x-workspace-slug)');
      }
      return makeService(context).revokeInvitation(invitationId, workspaceId);
    },
  },
};
