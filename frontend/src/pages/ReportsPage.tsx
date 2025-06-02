import { lazy, Suspense } from 'react';
import { Spinner } from '@/components/atoms/Spinner/Spinner';

/**
 * Carga diferida de ReportsView.
 * La vista de reportes incorpora Recharts para gráficas (burndown, velocidad,
 * cumulative flow), lo que representa un peso considerable. Separarlo en un
 * chunk dinámico evita que todos los usuarios paguen ese coste al inicio.
 */
const ReportsView = lazy(() => import('@/features/reports/components/ReportsView'));

/**
 * Página de Reportes y Métricas.
 *
 * Punto de entrada de ruta para los dashboards de métricas ágiles:
 * burndown chart, velocity, cumulative flow diagram y otros indicadores
 * de rendimiento del equipo. Usa lazy loading porque Recharts es una
 * dependencia pesada que solo debe cargarse cuando el usuario solicita
 * explícitamente esta sección.
 *
 * @returns El componente ReportsView envuelto en un límite Suspense.
 */
export default function ReportsPage() {
  return (
    // El spinner se muestra durante la descarga de Recharts y los datos de reportes
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Spinner size="lg" /></div>}>
      <ReportsView />
    </Suspense>
  );
}
