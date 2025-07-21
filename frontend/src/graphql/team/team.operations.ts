/**
 * @file team.operations.ts
 * @module graphql/team
 * @description Operaciones GraphQL para la gestión de miembros de equipo dentro de un workspace.
 * Incluye mutaciones para invitar usuarios, eliminar miembros y actualizar roles.
 * Estas operaciones están vinculadas a la gestión multi-tenant de ScrumForge,
 * donde cada workspace tiene su propio conjunto de miembros con roles diferenciados.
 */

import { gql } from '@apollo/client';

/**
 * @constant INVITE_MEMBER
 * @description Mutación para invitar a un nuevo miembro a un workspace mediante su dirección de email.
 * El servidor genera una invitación con fecha de expiración y la envía por correo al destinatario.
 *
 * @param {ID} workspaceId - Identificador del workspace al que se invita al usuario.
 * @param {String} email - Dirección de correo electrónico del invitado.
 * @param {String} role - Rol asignado al nuevo miembro (ej. DEVELOPER, SCRUM_MASTER, PRODUCT_OWNER).
 *
 * @returns {Object} Objeto de invitación con:
 * - `id` — Identificador único de la invitación.
 * - `workspaceId` — Workspace de destino.
 * - `email` — Email del invitado.
 * - `role` — Rol asignado en la invitación.
 * - `expiresAt` — Fecha límite para aceptar la invitación.
 * - `createdAt` — Fecha de creación de la invitación.
 */
export const INVITE_MEMBER = gql`
  mutation InviteMember($workspaceId: ID!, $email: String!, $role: String!) {
    inviteMember(workspaceId: $workspaceId, email: $email, role: $role) {
      id
      workspaceId
      email
      role
      expiresAt
      createdAt
    }
  }
`;

/**
 * @constant REMOVE_MEMBER
 * @description Mutación para eliminar un miembro de un equipo (team) dentro del workspace.
 * Retorna un booleano indicando si la operación fue exitosa.
 * Se distingue de revocar una invitación: opera sobre miembros ya activos.
 *
 * @param {ID} teamId - Identificador del equipo del que se elimina al usuario.
 * @param {ID} userId - Identificador del usuario a eliminar.
 *
 * @returns {Boolean} `true` si el miembro fue eliminado correctamente.
 */
export const REMOVE_MEMBER = gql`
  mutation RemoveMember($teamId: ID!, $userId: ID!) {
    removeMember(teamId: $teamId, userId: $userId)
  }
`;

/**
 * @constant UPDATE_MEMBER_ROLE
 * @description Mutación para actualizar el rol de un miembro existente dentro de un equipo.
 * Permite elevar o reducir permisos sin necesidad de eliminar y volver a invitar al usuario.
 * Usa el enum `TeamRole` del schema GraphQL para garantizar valores válidos.
 *
 * @param {ID} teamId - Identificador del equipo donde está el miembro.
 * @param {ID} userId - Identificador del usuario cuyo rol se actualiza.
 * @param {TeamRole} role - Nuevo rol a asignar (enum definido en el schema del backend).
 *
 * @returns {Object} Objeto parcial del miembro con:
 * - `id` — Identificador del miembro en el equipo.
 * - `role` — Nuevo rol asignado tras la actualización.
 */
export const UPDATE_MEMBER_ROLE = gql`
  mutation UpdateMemberRole($teamId: ID!, $userId: ID!, $role: TeamRole!) {
    updateMemberRole(teamId: $teamId, userId: $userId, role: $role) {
      id
      role
    }
  }
`;
