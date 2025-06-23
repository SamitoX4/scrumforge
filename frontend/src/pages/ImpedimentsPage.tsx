import ImpedimentsView from '@/features/impediments/components/ImpedimentsView';

/**
 * Página de Impedimentos.
 *
 * Componente de ruta que renderiza directamente ImpedimentsView sin lazy loading,
 * ya que ImpedimentsView es un componente relativamente ligero que usa inline styles
 * (sin SCSS Modules) y no justifica la sobrecarga de un chunk dinámico.
 *
 * Los impedimentos son obstáculos que el Scrum Master debe eliminar para que
 * el equipo pueda avanzar en el sprint.
 *
 * @returns El componente ImpedimentsView renderizado directamente.
 */
export default function ImpedimentsPage() {
  return <ImpedimentsView />;
}
