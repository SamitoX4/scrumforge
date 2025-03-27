/**
 * @file workspace-invitation.typedefs.ts
 * @module workspace-invitation
 * @description Definición del esquema GraphQL para las invitaciones a workspaces.
 *
 * Define el tipo `WorkspaceInvitation` que representa una invitación pendiente.
 * El campo `token` es el identificador único usado en el enlace del email;
 * solo se incluye en el esquema para que el frontend pueda mostrarlo en la
 * lista de invitaciones pendientes (solo accesible por propietarios/admins).
 *
 * El campo `acceptedAt` es null mientras la invitación no haya sido aceptada.
 * Las invitaciones expiradas o aceptadas no aparecen en `pendingInvitations`.
 */
export const workspaceInvitationTypeDefs = `#graphql
  """
  Invitación enviada por email para que un usuario se una a un workspace.
  """
  type WorkspaceInvitation {
    id: ID!
    workspaceId: String!
    """ Correo electrónico del usuario invitado. """
    email: String!
    """ Rol que tendrá el usuario al aceptar la invitación. """
    role: String!
    """ Token único incluido en el enlace de la invitación. """
    token: String!
    """ Fecha y hora de expiración de la invitación. """
    expiresAt: String!
    """ Fecha y hora de aceptación; null si aún no ha sido aceptada. """
    acceptedAt: DateTime
    createdAt: DateTime!
  }

  extend type Query {
    """ Retorna las invitaciones pendientes (activas y no expiradas) de un workspace. """
    pendingInvitations(workspaceId: ID!): [WorkspaceInvitation!]!
  }

  extend type Mutation {
    """ Envía una invitación por email para que un usuario se una al workspace. """
    inviteMember(workspaceId: ID!, email: String!, role: String!): WorkspaceInvitation!
    """ Acepta una invitación usando el token del enlace de email. """
    acceptInvitation(token: String!): Boolean!
    """ Revoca (cancela) una invitación pendiente por su ID. """
    revokeInvitation(invitationId: ID!): Boolean!
  }
`;
