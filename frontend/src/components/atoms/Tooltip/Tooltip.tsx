import clsx from 'clsx';
import styles from './Tooltip.module.scss';

/**
 * Props del componente Tooltip.
 */
interface TooltipProps {
  /** Texto que se muestra dentro del tooltip. */
  content: string;
  /** Elemento que activa el tooltip al recibir hover o foco. */
  children: React.ReactElement;
  /**
   * Posición preferida del tooltip respecto al elemento trigger.
   * Por defecto 'top'. El CSS puede ignorar la preferencia si no hay espacio.
   */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** Clases CSS adicionales para el wrapper externo. */
  className?: string;
}

/**
 * Tooltip — envuelve cualquier elemento y muestra un tooltip al hacer hover/foco.
 *
 * Implementación 100% CSS (visibility + opacity con transition) sin portal ni
 * cálculos de posición en JavaScript. Esto es suficiente para la mayoría de los
 * casos de uso en la aplicación y evita la complejidad de portales con popper.js.
 *
 * Cuándo NO usar esta implementación:
 * - Si el trigger está dentro de un contenedor con `overflow: hidden` que cortaría
 *   el tooltip → en ese caso hay que usar el DropdownMenu con portal.
 * - Si se necesita interactividad dentro del tooltip (links, botones).
 *
 * Accesibilidad:
 * - El tooltip tiene `role="tooltip"` para que sea asociado semánticamente
 *   al trigger por tecnologías asistivas.
 *
 * @example
 * <Tooltip content="Eliminar proyecto" placement="bottom">
 *   <button onClick={handleDelete}>✕</button>
 * </Tooltip>
 */
export function Tooltip({ content, children, placement = 'top', className }: TooltipProps) {
  return (
    // El wrapper position:relative es necesario para posicionar el tooltip en CSS puro
    <span className={clsx(styles.wrapper, className)}>
      {children}
      {/* El tooltip se muestra/oculta via CSS al hacer :hover o :focus-within en el wrapper */}
      <span
        className={clsx(styles.tooltip, styles[`tooltip--${placement}`])}
        role="tooltip"
      >
        {content}
      </span>
    </span>
  );
}
