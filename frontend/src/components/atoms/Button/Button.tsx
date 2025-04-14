import { ButtonHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';
import styles from './Button.module.scss';

/** Variante visual del botón — define esquema de colores y nivel de énfasis. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** Tamaño del botón — afecta padding y tamaño de fuente. */
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Props del componente Button.
 * Extiende todos los atributos HTML nativos de `<button>` para que
 * el componente sea un reemplazo transparente en cualquier formulario.
 * Base button component with variant, size and loading state support.
 */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Variante visual. Por defecto 'primary'. */
  variant?: ButtonVariant;
  /** Tamaño. Por defecto 'md'. */
  size?: ButtonSize;
  /**
   * Cuando es true, muestra un spinner interno y deshabilita el botón.
   * El texto del label se oculta visualmente (pero sigue en el DOM para
   * mantener el ancho del botón estable y evitar layout shifts).
   */
  loading?: boolean;
  /** Si es true, el botón ocupa el 100% del ancho de su contenedor. */
  fullWidth?: boolean;
}

/**
 * Button — botón base de la aplicación con soporte de variante, tamaño y estado de carga.
 *
 * Se implementa con `forwardRef` para que componentes padres (p.ej. formularios
 * con react-hook-form) puedan obtener una referencia al elemento DOM subyacente.
 *
 * Cuando `loading` es true:
 * - Se añade `disabled` y `aria-disabled` para bloquear interacción y lectores de pantalla.
 * - Se muestra un spinner CSS inline en lugar del texto.
 * - El label se oculta con una clase CSS para mantener el ancho del botón constante.
 *
 * @example
 * <Button variant="danger" loading={deleting} onClick={handleDelete}>
 *   Eliminar proyecto
 * </Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading = false, fullWidth = false, children, className, disabled, ...rest },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={clsx(
          styles.btn,
          styles[`btn--${variant}`],
          styles[`btn--${size}`],
          fullWidth && styles['btn--full'],
          loading && styles['btn--loading'],
          className,
        )}
        // Se deshabilita tanto por la prop `disabled` como por el estado `loading`
        disabled={disabled || loading}
        aria-disabled={disabled || loading}
        {...rest}
      >
        {/* Spinner CSS puro — aria-hidden para que lectores de pantalla ignoren el indicador visual */}
        {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
        {/* El label se oculta visualmente durante la carga pero permanece en el DOM */}
        <span className={loading ? styles['btn__label--hidden'] : undefined}>{children}</span>
      </button>
    );
  },
);

// displayName permite identificar el componente correctamente en React DevTools
Button.displayName = 'Button';
