/**
 * plan-limits.middleware.ts — Verificación de límites del plan de suscripción.
 *
 * Este módulo expone funciones de comprobación de límites que los resolvers
 * invocan antes de crear nuevos recursos (proyectos, miembros, etc.).
 *
 * Diseño:
 *  - Cada función comprueba un límite específico del plan del workspace.
 *  - Si el límite se ha alcanzado, lanza `PlanLimitExceededError` que el
 *    formateador de errores convierte en un error GraphQL claro para el cliente.
 *  - `PlanService` se instancia dentro de cada función (sin estado) para
 *    permitir que los resolvers la usen sin acoplarse al servicio directamente.
 *
 * Re-exporta `PlanService` y `PlanLimitExceededError` para que los módulos
 * solo necesiten importar desde este archivo, centralizando las importaciones
 * relacionadas con límites de plan.
 */

import { PrismaClient } from '@prisma/client';
import { PlanService, PlanLimitExceededError } from '../services/plan.service';

// Re-exportar para que los módulos no necesiten importar desde plan.service directamente
export { PlanService, PlanLimitExceededError };

/**
 * Verifica que el workspace no ha alcanzado el límite de proyectos de su plan.
 *
 * Cuenta todos los proyectos pertenecientes a equipos del workspace y los
 * compara con el límite `maxProjects` del plan activo. Si el conteo es >= al
 * límite, lanza `PlanLimitExceededError` antes de crear el nuevo proyecto.
 *
 * @param workspaceId - ID del workspace a verificar.
 * @param db          - Instancia de PrismaClient para consultar la DB.
 * @throws {PlanLimitExceededError} Si se ha alcanzado el límite de proyectos.
 */
export async function checkProjectLimit(
  workspaceId: string,
  db: PrismaClient,
): Promise<void> {
  const planService = new PlanService(db);

  // Obtener todos los equipos del workspace para contar sus proyectos.
  // Un workspace puede tener múltiples equipos, cada uno con múltiples proyectos.
  const teams = await db.team.findMany({ where: { workspaceId }, select: { id: true } });
  const teamIds = teams.map((t) => t.id);

  // Contar los proyectos de todos los equipos del workspace de forma eficiente
  // usando una sola query con filtro `in` en lugar de N queries por equipo.
  const projectCount = await db.project.count({ where: { teamId: { in: teamIds } } });

  // Delegar la verificación del límite al PlanService que conoce los límites
  // del plan activo del workspace.
  await planService.checkLimit(workspaceId, 'maxProjects', projectCount);
}

/**
 * Verifica que el workspace no ha alcanzado el límite de miembros de su plan.
 *
 * Cuenta todos los `TeamMember` de los equipos del workspace. Nota: si un
 * usuario pertenece a múltiples equipos del mismo workspace, se cuenta
 * varias veces (conteo por membresía, no por usuario único).
 *
 * @param workspaceId - ID del workspace a verificar.
 * @param db          - Instancia de PrismaClient para consultar la DB.
 * @throws {PlanLimitExceededError} Si se ha alcanzado el límite de miembros.
 */
export async function checkMemberLimit(
  workspaceId: string,
  db: PrismaClient,
): Promise<void> {
  const planService = new PlanService(db);

  // Misma estrategia que checkProjectLimit: obtener IDs de equipos primero
  const teams = await db.team.findMany({ where: { workspaceId }, select: { id: true } });
  const teamIds = teams.map((t) => t.id);

  // Contar membresías totales en todos los equipos del workspace
  const memberCount = await db.teamMember.count({ where: { teamId: { in: teamIds } } });

  await planService.checkLimit(workspaceId, 'maxMembers', memberCount);
}
