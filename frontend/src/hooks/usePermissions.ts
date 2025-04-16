/**
 * @file usePermissions.ts
 * @description Hook de permisos basado en roles — convierte el rol del usuario
 * en una interfaz declarativa para consultar permisos específicos.
 *
 * Sigue el modelo RBAC (Role-Based Access Control) con una tabla de permisos
 * estática definida en este módulo. Cada permiso es una lista de roles que lo
 * tienen habilitado; si el rol del usuario está en esa lista, tiene el permiso.
 *
 * Diseño intencional:
 * - La tabla `PERMISSIONS` es la única fuente de verdad para los permisos de la UI.
 * - Cambiar quién puede hacer qué solo requiere editar esta tabla, sin tocar componentes.
 * - Los permisos de la UI son una guía UX; la autorización real ocurre en el servidor.
 */
import type { TeamRole } from '@/types/api.types';

/**
 * Tabla de permisos — mapea cada acción a los roles que la pueden realizar.
 *
 * Se usa `as TeamRole[]` para que TypeScript valide que solo se usan roles válidos,
 * y para que la función `can()` pueda hacer la comprobación sin casting adicional.
 */
const PERMISSIONS = {
  /** Crear, editar y eliminar épicas e historias de usuario en el backlog. */
  canManageBacklog: ['PRODUCT_OWNER', 'SCRUM_MASTER'] as TeamRole[],
  /** Iniciar, completar y eliminar sprints. */
  canManageSprints: ['PRODUCT_OWNER', 'SCRUM_MASTER'] as TeamRole[],
  /** Ordenar historias en el backlog (solo el Product Owner decide la prioridad). */
  canPrioritizeBacklog: ['PRODUCT_OWNER'] as TeamRole[],
  /** Mover tarjetas entre columnas del tablero Kanban. */
  canMoveTasksOnBoard: ['PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPER'] as TeamRole[],
  /** Ver reportes de burndown, velocidad y métricas del proyecto. */
  canViewReports: ['PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPER', 'STAKEHOLDER'] as TeamRole[],
  /** Cambiar la configuración del proyecto (columnas, DoD, integraciones). */
  canConfigureProject: ['PRODUCT_OWNER', 'SCRUM_MASTER'] as TeamRole[],
  /** Enviar invitaciones de miembro al equipo. */
  canInviteMembers: ['PRODUCT_OWNER', 'SCRUM_MASTER'] as TeamRole[],
};

/** Tipo de los nombres de permiso disponibles — derivado de las claves de `PERMISSIONS`. */
export type Permission = keyof typeof PERMISSIONS;

/**
 * Hook que devuelve una función `can()` para consultar permisos del usuario.
 *
 * @param role - Rol del usuario en el proyecto. Si es `null` o `undefined`,
 *               todos los permisos devolverán `false` (acceso denegado).
 * @returns Objeto con la función `can(permission)`.
 *
 * @example
 * const role = useMyProjectRole(teamId);
 * const { can } = usePermissions(role);
 *
 * // En el render:
 * {can('canManageBacklog') && <CreateStoryButton />}
 */
export function usePermissions(role?: TeamRole | null) {
  /**
   * Comprueba si el rol actual tiene un permiso específico.
   *
   * @param permission - Nombre del permiso a comprobar.
   * @returns `true` si el rol tiene el permiso, `false` si no o si no hay rol.
   */
  function can(permission: Permission): boolean {
    // Sin rol → sin permisos (usuario no miembro del equipo o sesión no cargada)
    if (!role) return false;
    return (PERMISSIONS[permission] as TeamRole[]).includes(role);
  }

  return { can };
}
