/**
 * rbac.middleware.ts — Control de acceso basado en roles (RBAC).
 *
 * Implementa la verificación de permisos granulares por operación y proyecto.
 * A diferencia de la directiva `@hasRole` (que trabaja a nivel de schema SDL),
 * este módulo se usa dentro de los resolvers cuando la lógica de permisos
 * depende del contexto de ejecución (ej. el ID del proyecto viene de la DB,
 * no directamente de los argumentos de la query).
 *
 * Modelo de permisos:
 *  - Los permisos se asignan a roles (no a usuarios individuales).
 *  - Los roles se definen en el TeamMember de cada proyecto.
 *  - Un mismo usuario puede tener distintos roles en distintos proyectos.
 *  - La jerarquía de permisos está codificada en `ROLE_PERMISSIONS` (no en DB)
 *    para evitar consultas adicionales y para que los cambios requieran
 *    un despliegue deliberado.
 */

import { GraphQLError } from 'graphql';
import { prisma } from '../config/db/prisma.client';
import type { GraphQLContext } from '../graphql/context';

/**
 * Permisos granulares disponibles en la aplicación.
 * Cada permiso representa una acción específica que puede estar restringida
 * según el rol del usuario en el proyecto.
 */
export type Permission =
  | 'backlog:write'       // Crear y editar épicas e historias de usuario
  | 'backlog:prioritize'  // Reordenar y priorizar el backlog
  | 'sprint:manage'       // Crear, iniciar y cerrar sprints
  | 'board:move'          // Mover tareas en el tablero Kanban
  | 'reports:read'        // Ver reportes y métricas del proyecto
  | 'project:configure'   // Configurar ajustes del proyecto
  | 'member:invite';      // Invitar nuevos miembros al equipo

/**
 * Mapa de permisos por rol.
 * Cada rol incluye solo los permisos que le corresponden (sin herencia implícita).
 * Product Owner tiene todos los permisos; Stakeholder solo puede leer reportes.
 *
 * Nota: si se necesitan cambios frecuentes en permisos, considerar moverlos
 * a la base de datos (tabla de permisos dinámicos por plan/workspace).
 */
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  PRODUCT_OWNER: [
    'backlog:write',
    'backlog:prioritize',
    'sprint:manage',
    'board:move',
    'reports:read',
    'project:configure',
    'member:invite',
  ],
  SCRUM_MASTER: [
    'backlog:write',
    'sprint:manage',
    'board:move',
    'reports:read',
    'project:configure',
    'member:invite',
  ],
  DEVELOPER: ['board:move', 'reports:read'],
  STAKEHOLDER: ['reports:read'],
};

/**
 * Verifica que el usuario autenticado tiene el permiso requerido en el proyecto.
 *
 * Lanza un `GraphQLError` con el código apropiado si el usuario no está
 * autenticado, el proyecto no existe, el usuario no es miembro del equipo
 * o su rol no incluye el permiso solicitado.
 *
 * @param context    - Contexto GraphQL con el usuario autenticado.
 * @param projectId  - ID del proyecto donde se verifica el permiso.
 * @param permission - Permiso específico requerido para la operación.
 * @throws {GraphQLError} Con código UNAUTHENTICATED, NOT_FOUND o FORBIDDEN.
 */
export async function requirePermission(
  context: GraphQLContext,
  projectId: string,
  permission: Permission,
): Promise<void> {
  if (!context.user) {
    throw new GraphQLError('No autenticado', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }

  // Cargar el proyecto junto con su equipo y miembros en una sola query
  // para evitar múltiples round-trips a la base de datos.
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { team: { include: { members: true } } },
  });

  if (!project) {
    throw new GraphQLError('Proyecto no encontrado', {
      extensions: { code: 'NOT_FOUND' },
    });
  }

  // Buscar la membresía del usuario en el equipo del proyecto
  const membership = project.team.members.find((m) => m.userId === context.user!.id);

  if (!membership) {
    throw new GraphQLError('No tienes acceso a este proyecto', {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  // Verificar si el rol del usuario incluye el permiso requerido
  const allowed = ROLE_PERMISSIONS[membership.role] ?? [];
  if (!allowed.includes(permission)) {
    throw new GraphQLError(
      `No tienes permiso para realizar esta acción (requiere: ${permission})`,
      { extensions: { code: 'FORBIDDEN' } },
    );
  }
}

/**
 * Devuelve el rol del usuario en el equipo del proyecto, o `null` si el
 * usuario no está autenticado o no es miembro del equipo.
 *
 * Se usa para lógica condicional en resolvers donde el comportamiento
 * varía según el rol (ej. mostrar u ocultar campos según el rol).
 *
 * @param context   - Contexto GraphQL con el usuario autenticado.
 * @param projectId - ID del proyecto a consultar.
 * @returns Rol del usuario (ej. 'DEVELOPER') o `null` si no es miembro.
 */
export async function getProjectRole(
  context: GraphQLContext,
  projectId: string,
): Promise<string | null> {
  if (!context.user) return null;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { team: { include: { members: true } } },
  });

  if (!project) return null;

  // Buscar la membresía del usuario y devolver su rol
  const membership = project.team.members.find((m) => m.userId === context.user!.id);
  return membership?.role ?? null;
}
