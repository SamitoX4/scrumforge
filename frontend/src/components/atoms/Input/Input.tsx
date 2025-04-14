import { InputHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';
import styles from './Input.module.scss';

/**
 * Props del componente Input.
 * Extiende los atributos HTML nativos de `<input>` para ser un reemplazo
 * transparente con soporte adicional de estado de error visual.
 * Base input field with optional error state.
 */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * Cuando es true, aplica estilos de borde rojo para indicar validación fallida.
   * La descripción del error se debe mostrar en el componente padre (p.ej. FormField).
   */
  error?: boolean;
}

/**
 * Input — campo de texto base de la aplicación.
 *
 * Se implementa con `forwardRef` para que librerías de formularios como
 * react-hook-form o componentes padres puedan acceder directamente al
 * elemento `<input>` del DOM (p.ej. para enfocar el campo tras un error).
 *
 * El estado `error` sólo afecta la apariencia visual (borde rojo).
 * Los mensajes de error deben gestionarse externamente, idealmente
 * con el componente `FormField` que envuelve este Input.
 *
 * @example
 * <Input
 *   id="email"
 *   type="email"
 *   value={email}
 *   onChange={(e) => setEmail(e.target.value)}
 *   error={!!errors.email}
 *   placeholder="tu@empresa.com"
 * />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error = false, className, ...rest }, ref) => {
    return (
      <input
        ref={ref}
        // La clase 'input--error' activa el borde rojo definido en el módulo SCSS
        className={clsx(styles.input, error && styles['input--error'], className)}
        {...rest}
      />
    );
  },
);

// displayName facilita la identificación en React DevTools y stack traces
Input.displayName = 'Input';
