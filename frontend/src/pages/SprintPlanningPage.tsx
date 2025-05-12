import { lazy, Suspense } from 'react';
import { Spinner } from '@/components/atoms/Spinner/Spinner';

/**
 * Carga diferida de SprintPlanningView.
 * La vista de planificación incluye Planning Poker y lógica de estimación
 * colaborativa, lo que justifica separarla en su propio chunk de código.
 */
const SprintPlanningView = lazy(() => import('@/features/sprint/components/SprintPlanningView'));

/**
 * Página de Planificación de Sprint.
 *
 * Envuelve SprintPlanningView con lazy loading. Esta página contiene
 * la funcionalidad de Planning Poker (estimación colaborativa en tiempo real
 * vía WebSocket), creación de sprints y asignación de historias al sprint.
 * El código se divide en un chunk separado porque es un módulo de uso
 * ocasional que no debe penalizar la carga de otras rutas.
 *
 * @returns El componente SprintPlanningView envuelto en un límite Suspense.
 */
export default function SprintPlanningPage() {
  return (
    // Spinner mientras se descarga el módulo de planificación (puede incluir
    // dependencias de WebSocket y lógica de Planning Poker)
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Spinner size="lg" /></div>}>
      <SprintPlanningView />
    </Suspense>
  );
}
