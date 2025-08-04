/**
 * @file usePlanFeatures.ts
 * @description Hook que expone los límites y features del plan activo del workspace.
 *
 * ScrumForge es un SaaS multi-plan; cada workspace tiene un plan (free, pro, enterprise)
 * con distintos límites (número de proyectos, miembros) y features booleanas (IA, planning poker,
 * retrospectivas, etc.). Este hook centraliza la comprobación de features para que los
 * componentes puedan mostrar un `<UpgradePrompt>` cuando una feature no está disponible.
 *
 * Los datos de `planLimits` provienen del campo `planLimits` del workspace, que el servidor
 * calcula a partir del plan activo de Stripe. Se obtienen vía `useCurrentWorkspace`.
 */
import { useCurrentWorkspace } from './useCurrentWorkspace';
import type { WorkspacePlanLimits } from '@/types/api.types';

/**
 * Hook que devuelve los límites del plan activo y una función para comprobar features.
 *
 * Comportamiento cuando el workspace aún está cargando:
 * - `limits` es `{}` (objeto vacío).
 * - `canUse()` devuelve `true` para evitar un flash del `<UpgradePrompt>` durante la carga.
 *   Una vez que el workspace carga, si la feature no está disponible, el componente
 *   re-renderiza y muestra el prompt correctamente.
 *
 * @returns Objeto con `limits` (límites numéricos y booleanos del plan) y `canUse`.
 *
 * @example
 * const { canUse } = usePlanFeatures();
 * if (!canUse('planningPoker')) return <UpgradePrompt feature="Planning Poker" />;
 * return <PlanningPokerView />;
 */
export function usePlanFeatures() {
  const { workspace } = useCurrentWorkspace();
  // Si el workspace no ha cargado, usar un objeto vacío como fallback
  const limits: WorkspacePlanLimits = workspace?.planLimits ?? {};

  /**
   * Verifica si una feature o límite está habilitado en el plan activo.
   *
   * Lógica de evaluación:
   * - Si el workspace no ha cargado → `true` (evitar bloqueo durante el loading).
   * - Si el límite es `undefined` o `null` → `true` (ilimitado, feature incluida).
   * - Si el límite es `boolean` → devuelve el valor directamente.
   * - Si el límite es `number` → devuelve `true` si es mayor que 0.
   *
   * @param feature - Clave de `WorkspacePlanLimits` a comprobar.
   * @returns `true` si la feature está disponible en el plan activo.
   */
  function canUse(feature: keyof WorkspacePlanLimits): boolean {
    // Workspace aún cargando → no bloquear para evitar flash del UpgradePrompt
    if (!workspace) return true;
    const value = limits[feature];
    // Sin límite definido → feature ilimitada (incluida en todos los planes)
    if (value === undefined || value === null) return true;
    // Feature booleana → devolver directamente
    if (typeof value === 'boolean') return value;
    // Límite numérico → disponible si el límite es positivo (> 0 = no agotado)
    if (typeof value === 'number') return value > 0;
    return true;
  }

  return { limits, canUse };
}
