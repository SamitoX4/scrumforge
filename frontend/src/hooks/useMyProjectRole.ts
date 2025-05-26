/**
 * @file useMyProjectRole.ts
 * @description Hook que resuelve el rol del usuario autenticado en un equipo de proyecto.
 *
 * El rol determina qué acciones puede realizar el usuario en la UI (mover tareas,
 * gestionar el backlog, configurar el proyecto, etc.). Se combina con `usePermissions`
 * para obtener una interfaz declarativa de permisos.
 *
 * La query consulta los miembros del equipo y filtra por el ID del usuario actual
 * del store de auth. Este enfoque es más simple que añadir un resolver específico
 * `myRoleInTeam` en el servidor, aunque implica transferir todos los miembros.
 * Para equipos grandes, considerar añadir ese resolver específico en el backend.
 */
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useAuthStore } from '@/store/auth.store';
import type { TeamRole } from '@/types/api.types';

/**
 * Query que obtiene la lista de miembros del equipo con su rol.
 * Solo se piden los campos necesarios para el filtrado (userId y role).
 */
const GET_MY_ROLE = gql`
  query GetMyRole($teamId: ID!) {
    team(id: $teamId) {
      members { userId role }
    }
  }
`;

/**
 * Devuelve el rol del usuario autenticado en el equipo especificado.
 *
 * @param teamId - ID del equipo del proyecto. Si es `null` o `undefined`,
 *                 la query se omite y se devuelve `null`.
 * @returns El rol del usuario (`PRODUCT_OWNER`, `SCRUM_MASTER`, `DEVELOPER`,
 *          `STAKEHOLDER`) o `null` si no es miembro del equipo o los datos
 *          aún no han cargado.
 *
 * @example
 * const role = useMyProjectRole(project?.teamId);
 * const { can } = usePermissions(role);
 * if (can('canManageBacklog')) { ... }
 */
export function useMyProjectRole(teamId: string | null | undefined): TeamRole | null {
  // Obtener el usuario actual del store de auth para comparar con los miembros
  const { user } = useAuthStore();

  const { data } = useQuery<any>(GET_MY_ROLE, {
    variables: { teamId },
    // Omitir la query si no hay teamId o no hay usuario autenticado
    skip: !teamId || !user,
  });

  // Si no hay usuario o la query no ha cargado, no hay rol
  if (!user || !data?.team?.members) return null;

  // Buscar al usuario actual entre los miembros del equipo por su ID
  const member = (data.team.members as { userId: string; role: TeamRole }[])
    .find((m) => m.userId === user.id);

  // Retorna null si el usuario no es miembro del equipo (ej. admin de workspace sin rol en el proyecto)
  return member?.role ?? null;
}
