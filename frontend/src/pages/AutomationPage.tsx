import { lazy, Suspense } from 'react';
import { Spinner } from '@/components/atoms/Spinner/Spinner';

/**
 * Carga diferida del módulo de automatizaciones.
 * Se nombra AutomationFeaturePage para distinguirla del componente de página
 * que lo envuelve y evitar conflictos de nombre en el mismo archivo.
 */
const AutomationFeaturePage = lazy(() => import('@/features/automation/AutomationPage'));

/**
 * Página de Automatizaciones.
 *
 * Punto de entrada de ruta para la funcionalidad de automatizaciones con IA.
 * Aplica lazy loading sobre el módulo de features para no aumentar el bundle
 * principal con la lógica de reglas de automatización (E-10).
 *
 * @returns El componente AutomationFeaturePage envuelto en un límite Suspense.
 */
export default function AutomationPage() {
  return (
    // El spinner se muestra mientras se descarga y ejecuta el módulo de automatización
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Spinner size="lg" /></div>}>
      <AutomationFeaturePage />
    </Suspense>
  );
}
