/**
 * @fileoverview Componente ToastContainer — contenedor global de notificaciones toast.
 *
 * Renderiza la pila de toasts activos del store global de UI fuera del árbol
 * de componentes principal usando un portal de React. Al montarse directamente
 * en `document.body`, los toasts no se ven afectados por el z-index, overflow
 * o transformaciones CSS de ningún componente padre, garantizando que siempre
 * sean visibles en primer plano.
 */

import { createPortal } from 'react-dom';
import { useUIStore } from '@/store/ui.store';
import styles from './ToastContainer.module.scss';
import clsx from 'clsx';

/**
 * Componente que muestra las notificaciones toast activas de la aplicación.
 *
 * Lee la lista de toasts del store Zustand (`ui.store`) y los renderiza como
 * elementos apilados en la esquina de la pantalla. Cada toast incluye el
 * mensaje y un botón para cerrarlo manualmente. La variante visual (color,
 * icono) se determina por el `type` del toast (ej. "success", "error", "info").
 *
 * El componente se auto-elimina del DOM cuando no hay toasts activos,
 * evitando nodos vacíos y listeners innecesarios.
 *
 * @returns Portal de React montado en `document.body`, o `null` si no hay
 *   toasts que mostrar.
 *
 * @example
 * // Se registra una sola vez en el layout raíz de la aplicación:
 * function App() {
 *   return (
 *     <>
 *       <RouterOutlet />
 *       <ToastContainer />
 *     </>
 *   );
 * }
 */
export function ToastContainer() {
  // Se obtienen los toasts activos y la función para eliminarlos del store global.
  // Al usar Zustand con selector, el componente solo re-renderiza cuando cambia
  // la lista de toasts, no ante cualquier cambio del store de UI.
  const { toasts, removeToast } = useUIStore();

  // Optimización: si no hay toasts, no se crea ningún nodo en el DOM.
  // Esto también evita que el portal se monte innecesariamente.
  if (toasts.length === 0) return null;

  return createPortal(
    // `role="region"` y `aria-label` permiten a los lectores de pantalla
    // identificar esta zona como área de notificaciones del sistema.
    <div className={styles.container} role="region" aria-label="Notificaciones">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          // `clsx` combina la clase base del toast con la clase modificadora
          // BEM según el tipo (ej. `toast--success`, `toast--error`),
          // lo que permite estilos visuales distintos para cada severidad.
          className={clsx(styles.toast, styles[`toast--${toast.type}`])}
          // `role="alert"` hace que los lectores de pantalla anuncien
          // automáticamente el contenido del toast cuando aparece en pantalla,
          // sin necesidad de que el usuario mueva el foco al elemento.
          role="alert"
        >
          <span className={styles.message}>{toast.message}</span>
          <button
            className={styles.close}
            // Al hacer clic se elimina el toast del store por su ID único,
            // lo que desencadena el re-render y retira el elemento del DOM.
            onClick={() => removeToast(toast.id)}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      ))}
    </div>,
    // Se monta en document.body para escapar de cualquier contexto de
    // apilamiento (stacking context) que pudiera ocultar los toasts.
    document.body,
  );
}
