import { lazy, Suspense } from 'react';
import { Spinner } from '@/components/atoms/Spinner/Spinner';

/**
 * Carga diferida de BacklogView para reducir el bundle inicial.
 * El componente se descarga solo cuando el usuario navega a esta ruta,
 * mejorando el tiempo de carga inicial de la aplicación (code splitting).
 */
const BacklogView = lazy(() => import('@/features/backlog/components/BacklogView'));

/**
 * Página del Backlog del producto.
 *
 * Actúa como envoltura de ruta que aplica lazy loading sobre BacklogView.
 * Mientras el chunk del módulo se descarga y evalúa, muestra un spinner
 * centrado para que el usuario tenga retroalimentación visual inmediata.
 *
 * @returns El componente BacklogView envuelto en un límite Suspense.
 */
export default function BacklogPage() {
  return (
    // Suspense actúa como límite de carga: mientras BacklogView no esté listo,
    // se renderiza el fallback con el spinner en lugar de una pantalla en blanco.
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Spinner size="lg" /></div>}>
      <BacklogView />
    </Suspense>
  );
}
