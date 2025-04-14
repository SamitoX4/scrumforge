import styles from './Spinner.module.scss';
import clsx from 'clsx';

/**
 * Props del componente Spinner.
 */
interface SpinnerProps {
  /** Tamaño del spinner. Por defecto 'md'. */
  size?: 'sm' | 'md' | 'lg';
  /** Clases CSS adicionales para el elemento raíz. */
  className?: string;
}

/**
 * Spinner — indicador de carga animado mediante CSS puro.
 *
 * Implementado como un `<span>` vacío cuya animación de rotación está
 * enteramente en CSS (sin JavaScript), lo que minimiza el bundle y evita
 * parpadeos durante el SSR/hydration.
 *
 * Accesibilidad:
 * - `role="status"` anuncia el estado de carga a lectores de pantalla.
 * - `aria-label="Cargando..."` proporciona el texto leído por los lectores.
 *
 * @example
 * // Spinner de pantalla completa durante carga inicial
 * if (loading) return <Spinner size="lg" />;
 *
 * // Spinner inline dentro de un botón (ver Button.tsx para el patrón integrado)
 * <Spinner size="sm" className={styles.inlineSpinner} />
 */
export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span
      className={clsx(styles.spinner, styles[`spinner--${size}`], className)}
      role="status"
      aria-label="Cargando..."
    />
  );
}
