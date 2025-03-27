/**
 * @file index.ts
 * @module workspace-invitation
 * @description Punto de entrada del módulo de invitaciones a workspaces.
 *
 * Re-exporta los tres artefactos principales del módulo para registro
 * centralizado en el servidor Apollo:
 * - `workspaceInvitationTypeDefs`: definición del esquema GraphQL.
 * - `workspaceInvitationResolvers`: implementación de queries y mutaciones.
 * - `WorkspaceInvitationService`: clase de servicio para uso en otros módulos.
 */
export { workspaceInvitationTypeDefs } from './workspace-invitation.typedefs';
export { workspaceInvitationResolvers } from './workspace-invitation.resolver';
export { WorkspaceInvitationService } from './workspace-invitation.service';
