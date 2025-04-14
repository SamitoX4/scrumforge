import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import styles from './Badge.module.scss';
import type { Priority, StoryStatus, TeamRole } from '@/types/api.types';

/**
 * Variantes visuales del Badge.
 * Reutiliza los tipos de dominio (Priority, StoryStatus, TeamRole) para que
 * el color del badge sea siempre coherente con el valor semántico mostrado.
 * 'default' sirve como fallback neutro cuando no aplica ningún tipo de dominio.
 */
type BadgeVariant = Priority | StoryStatus | TeamRole | 'default';

/**
 * Props del componente Badge.
 * Colored badge for priority, status, and role labels.
 */
interface BadgeProps {
  /** Variante visual — determina el color del badge vía CSS Modules. */
  variant?: BadgeVariant;
  /** Contenido del badge (texto, iconos, etc.). */
  children: React.ReactNode;
  /** Clases CSS adicionales. */
  className?: string;
}

/**
 * Badge — etiqueta de colores para prioridades, estados y roles.
 *
 * El color se aplica mediante la clase CSS `badge--{variant}`, definida
 * en Badge.module.scss. Esto permite añadir nuevas variantes simplemente
 * extendiendo el SCSS sin tocar este componente.
 */
export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span className={clsx(styles.badge, styles[`badge--${variant}`], className)}>
      {children}
    </span>
  );
}

/**
 * StatusBadge — conveniente wrapper de Badge para estados de historia.
 * Traduce automáticamente el valor del estado usando i18n,
 * evitando repetir la llamada a `t()` en cada uso.
 */
export function StatusBadge({ status }: { status: StoryStatus }) {
  const { t } = useTranslation();
  // defaultValue = status garantiza que se muestre algo incluso si la clave no existe
  return <Badge variant={status}>{t(`status.${status}`, { defaultValue: status })}</Badge>;
}

/**
 * PriorityBadge — conveniente wrapper de Badge para prioridades.
 * Traduce el valor de prioridad con fallback al valor crudo.
 */
export function PriorityBadge({ priority }: { priority: Priority }) {
  const { t } = useTranslation();
  return <Badge variant={priority}>{t(`priority.${priority}`, { defaultValue: priority })}</Badge>;
}

/**
 * RoleBadge — conveniente wrapper de Badge para roles de equipo.
 * Traduce el rol con fallback al valor crudo del enum.
 */
export function RoleBadge({ role }: { role: TeamRole }) {
  const { t } = useTranslation();
  return <Badge variant={role}>{t(`roles.${role}`, { defaultValue: role })}</Badge>;
}
