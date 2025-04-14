import { ReactNode } from 'react';
import styles from './FormField.module.scss';

/**
 * Props del componente FormField.
 *
 * @property label    - Texto de la etiqueta visible asociada al campo.
 * @property htmlFor  - ID del campo de formulario al que apunta el `<label>`.
 *                      Debe coincidir con el `id` del input hijo para mantener
 *                      la accesibilidad (click en label → foco en input).
 * @property error    - Mensaje de error a mostrar debajo del campo. Cuando está
 *                      presente oculta el hint para evitar conflictos visuales.
 * @property required - Si es true muestra un asterisco (*) junto al label.
 * @property hint     - Texto de ayuda opcional mostrado bajo el input cuando no hay error.
 * @property children - El campo de formulario en sí (Input, Select, Textarea, etc.).
 */
interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}

/**
 * FormField — contenedor accesible de label + input + mensaje de error/ayuda.
 *
 * Centraliza la lógica repetitiva de cada campo de formulario:
 * - Renderiza el `<label>` correctamente asociado al input mediante `htmlFor`.
 * - Muestra un asterisco (*) visual cuando el campo es requerido, con `aria-hidden`
 *   para que los lectores de pantalla no lo lean (el `required` nativo del input
 *   se encarga del anuncio accesible).
 * - Muestra hint o error de forma mutuamente excluyente: el error tiene prioridad.
 * - El `<p>` de error lleva `role="alert"` para que los lectores de pantalla
 *   lo anuncien automáticamente cuando aparece.
 *
 * El componente no gestiona el estado del campo — es puramente presentacional.
 * La lógica de validación debe vivir en el padre (p.ej. con react-hook-form).
 *
 * @example
 * <FormField label="Correo electrónico" htmlFor="email" required error={errors.email?.message}>
 *   <Input id="email" type="email" {...register('email')} error={!!errors.email} />
 * </FormField>
 */
export function FormField({ label, htmlFor, error, required, hint, children }: FormFieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
        {/* El asterisco es decorativo — aria-hidden evita que el lector diga "asterisco" */}
        {required && <span className={styles.required} aria-hidden="true"> *</span>}
      </label>
      {/* Slot para el campo de formulario (Input, Select, etc.) */}
      {children}
      {/* El hint solo se muestra cuando no hay error para no saturar la UI */}
      {hint && !error && <p className={styles.hint}>{hint}</p>}
      {/* role="alert" hace que el lector de pantalla anuncie el error en cuanto aparece */}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
