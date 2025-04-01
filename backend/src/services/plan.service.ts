/**
 * @file plan.service.ts
 * @description Servicio de gestión de planes y límites de suscripción.
 * Controla qué funcionalidades y cuántos recursos puede usar cada workspace
 * según el plan contratado (free, pro, business, etc.).
 *
 * Las restricciones se modelan en dos formas:
 *   - **Feature flag booleano** (ej. `integrations: false`): la funcionalidad
 *     está habilitada o deshabilitada por completo.
 *   - **Límite numérico** (ej. `maxProjects: 3`): el recurso tiene una cuota máxima.
 *
 * Cuando `null` o `undefined`, el límite se considera ilimitado.
 */

import { PrismaClient } from '@prisma/client';

/**
 * Identificadores de los límites/funcionalidades que pueden estar
 * restringidos según el plan del workspace.
 */
export type LimitType =
  | 'maxProjects'
  | 'maxMembers'
  | 'storageMb'
  | 'sprintHistory'
  | 'integrations'
  | 'planningPoker'
  | 'advancedReports'
  | 'ai'
  | 'retrospective'
  | 'wiki';

/**
 * Error lanzado cuando una operación intenta superar los límites del plan
 * actual del workspace. Los resolvers GraphQL pueden capturarlo y devolver
 * un mensaje amigable al cliente.
 */
export class PlanLimitExceededError extends Error {
  /**
   * @param limitType - Tipo de límite que se ha alcanzado.
   * @param planName  - Nombre del plan activo (para incluirlo en el mensaje).
   */
  constructor(limitType: LimitType, planName: string) {
    super(`Límite alcanzado: ${limitType} en plan ${planName}. Actualiza tu plan para continuar.`);
    this.name = 'PlanLimitExceededError';
  }
}

/**
 * Límites ilimitados que se aplican cuando la extensión `billing-stripe` no
 * está habilitada. Si no hay sistema de facturación, no tiene sentido restringir
 * nada — el operador del servidor es responsable de controlar el acceso.
 */
const UNLIMITED_PLAN_LIMITS: Record<string, unknown> = {
  maxProjects: null,
  maxMembers: null,
  storageMb: null,
  sprintHistory: null,
  integrations: true,
  planningPoker: true,
  advancedReports: true,
  ai: true,
  retrospective: true,
  wiki: true,
};

/**
 * Devuelve `true` si la extensión de billing está activa en esta instancia.
 * Se comprueba la variable de entorno `ENABLED_EXTENSIONS` del servidor.
 * Cuando no está presente, no se aplican restricciones de plan.
 */
function isBillingEnabled(): boolean {
  const enabled = process.env.ENABLED_EXTENSIONS ?? '';
  return enabled.split(',').map((e) => e.trim()).includes('billing-stripe');
}

/**
 * Límites predeterminados del plan gratuito.
 * Se aplican cuando el workspace no tiene una suscripción activa en la BD.
 * Todos los valores numéricos son cuotas máximas; `false` indica que la
 * funcionalidad no está disponible en este nivel.
 */
const FREE_PLAN_LIMITS: Record<string, unknown> = {
  maxProjects: 3,
  maxMembers: 5,
  storageMb: 100,
  sprintHistory: 5,
  integrations: false,
  planningPoker: false,
  advancedReports: false,
  ai: false,
  retrospective: false,
  wiki: false,
};

/**
 * Servicio que consulta el plan del workspace y verifica si una operación
 * está permitida según sus límites.
 */
export class PlanService {
  /**
   * @param db - Cliente Prisma para consultar la tabla `Subscription` y `Plan`.
   */
  constructor(private readonly db: PrismaClient) {}

  /**
   * Obtiene el plan activo y sus límites para un workspace dado.
   * Si el workspace no tiene suscripción, retorna el plan `free` con sus
   * límites por defecto definidos en {@link FREE_PLAN_LIMITS}.
   *
   * @param workspaceId - ID del workspace a consultar.
   * @returns Objeto con el nombre del plan y el mapa de límites.
   */
  async getWorkspacePlan(
    workspaceId: string,
  ): Promise<{ planName: string; limits: Record<string, unknown> }> {
    // Si billing-stripe no está habilitado, esta instancia no gestiona planes:
    // todos los workspaces tienen acceso ilimitado a todas las funcionalidades.
    if (!isBillingEnabled()) {
      return { planName: 'unlimited', limits: UNLIMITED_PLAN_LIMITS };
    }

    const subscription = await this.db.subscription.findUnique({
      where: { workspaceId },
      include: { plan: true },
    });

    // Sin suscripción activa, se aplican los límites del plan free por defecto
    if (!subscription) {
      return { planName: 'free', limits: FREE_PLAN_LIMITS };
    }

    // Los límites se almacenan como JSON en el modelo Plan de Prisma
    const limits = subscription.plan.limits as Record<string, unknown>;
    return { planName: subscription.plan.name, limits };
  }

  /**
   * Verifica si una operación está permitida por el plan del workspace.
   * Lanza {@link PlanLimitExceededError} si el límite ha sido alcanzado o
   * la funcionalidad está deshabilitada para el plan actual.
   *
   * Lógica de evaluación:
   *   - Si el valor del límite es `null` o `undefined` → sin restricción, pasa.
   *   - Si es `boolean` → `true` permite, `false` bloquea.
   *   - Si es `number` y se provee `currentCount` → bloquea si `currentCount >= limite`.
   *
   * @param workspaceId  - ID del workspace a verificar.
   * @param limitType    - Tipo de límite a comprobar.
   * @param currentCount - Cantidad actual del recurso (solo para límites numéricos).
   * @throws {PlanLimitExceededError} Si el límite está alcanzado o la feature está bloqueada.
   */
  async checkLimit(
    workspaceId: string,
    limitType: LimitType,
    currentCount?: number,
  ): Promise<void> {
    const { planName, limits } = await this.getWorkspacePlan(workspaceId);
    const limitValue = limits[limitType];

    // null/undefined significa "sin límite" en este plan → permitir sin restricción
    if (limitValue === null || limitValue === undefined) return;

    // Feature flag booleano: false deshabilita completamente la funcionalidad
    if (typeof limitValue === 'boolean') {
      if (!limitValue) {
        throw new PlanLimitExceededError(limitType, planName);
      }
      return;
    }

    // Límite numérico: se compara la cantidad actual contra el techo del plan
    if (typeof limitValue === 'number' && currentCount !== undefined) {
      if (currentCount >= limitValue) {
        throw new PlanLimitExceededError(limitType, planName);
      }
    }
  }
}
