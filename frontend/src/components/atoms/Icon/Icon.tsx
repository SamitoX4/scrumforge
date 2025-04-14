import clsx from 'clsx';
import styles from './Icon.module.scss';

/**
 * Props del componente Icon.
 */
interface IconProps {
  /** Carácter del icono — emoji o símbolo unicode (p.ej. '🔍', '⋮', '✓'). */
  name: string;
  /** Tamaño visual. Por defecto 'md'. */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /**
   * Etiqueta accesible para lectores de pantalla.
   * Si se omite, el icono se considera decorativo y se oculta con `aria-hidden`.
   * Si se proporciona, el `<span>` recibe `role="img"` y `aria-label`.
   */
  label?: string;
  /** Clases CSS adicionales. */
  className?: string;
}

/**
 * Icon — wrapper ligero para iconos de texto/emoji.
 *
 * Gestiona de forma centralizada el tamaño y los atributos de accesibilidad,
 * evitando la duplicación de lógica en cada sitio donde se usa un icono.
 *
 * Accesibilidad:
 * - Si `label` está presente → `role="img"` + `aria-label` (icono semántico).
 * - Si `label` está ausente  → `aria-hidden="true"` (icono puramente decorativo).
 *
 * @example
 * // Icono decorativo (no anunciado por lectores de pantalla)
 * <Icon name="🔍" size="sm" />
 *
 * // Icono semántico (leído como "Buscar" por lectores de pantalla)
 * <Icon name="🔍" label="Buscar" />
 */
export function Icon({ name, size = 'md', label, className }: IconProps) {
  return (
    <span
      className={clsx(styles.icon, styles[`icon--${size}`], className)}
      // role="img" solo se aplica cuando hay una etiqueta descriptiva
      role={label ? 'img' : undefined}
      aria-label={label}
      // aria-hidden=true oculta el icono a tecnologías asistivas cuando es decorativo
      aria-hidden={!label || undefined}
    >
      {name}
    </span>
  );
}
