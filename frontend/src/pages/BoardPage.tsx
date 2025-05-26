import { lazy, Suspense } from 'react';
import { Spinner } from '@/components/atoms/Spinner/Spinner';

/**
 * Carga diferida de BoardView para evitar incluir la lógica del tablero Kanban
 * en el bundle principal. Se descarga únicamente cuando se navega a esta ruta.
 */
const BoardView = lazy(() => import('@/features/board/components/BoardView'));

/**
 * Página del tablero Kanban (Board).
 *
 * Envuelve BoardView con lazy loading y un fallback de carga visual.
 * El tablero es uno de los módulos más pesados (dnd-kit, columnas, tarjetas),
 * por lo que diferir su carga mejora notablemente el tiempo hasta primer render.
 *
 * @returns El componente BoardView envuelto en un límite Suspense.
 */
export default function BoardPage() {
  return (
    // Muestra spinner centrado mientras se descarga el chunk del tablero Kanban
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Spinner size="lg" /></div>}>
      <BoardView />
    </Suspense>
  );
}
