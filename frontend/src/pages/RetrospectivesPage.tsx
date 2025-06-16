import RetrospectivesView from '@/features/retrospective/RetrospectivesView';

/**
 * Página de Retrospectivas.
 *
 * Componente de ruta que renderiza directamente RetrospectivesView sin lazy loading.
 * Al igual que ImpedimentsView, este componente es ligero y usa inline styles,
 * por lo que la importación directa es preferible para evitar la latencia
 * adicional de un chunk dinámico en módulos de poco peso.
 *
 * Las retrospectivas permiten al equipo reflexionar sobre el sprint finalizado
 * e identificar mejoras para el siguiente ciclo (formato: Qué fue bien /
 * Qué mejorar / Acciones de mejora).
 *
 * @returns El componente RetrospectivesView renderizado directamente.
 */
export default function RetrospectivesPage() {
  return <RetrospectivesView />;
}
