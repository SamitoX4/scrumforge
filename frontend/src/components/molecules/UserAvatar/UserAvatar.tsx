import { Avatar } from '@/components/atoms/Avatar/Avatar';
import type { TeamRole } from '@/types/api.types';
import styles from './UserAvatar.module.scss';

/**
 * Mapeo de valores enum de rol a etiquetas legibles en inglés.
 * Se usa inglés por ser la terminología estándar de Scrum reconocida
 * internacionalmente, independientemente del idioma de la interfaz.
 */
const ROLE_LABELS: Record<TeamRole, string> = {
  PRODUCT_OWNER: 'Product Owner',
  SCRUM_MASTER: 'Scrum Master',
  DEVELOPER: 'Developer',
  STAKEHOLDER: 'Stakeholder',
};

/**
 * Props del componente UserAvatar.
 *
 * @property user      - Objeto con los datos del usuario a mostrar.
 * @property role      - Rol del equipo del usuario, mostrado como texto secundario.
 *                       Si es null y hay email, se muestra el email en su lugar.
 * @property size      - Tamaño del avatar (hereda los valores de Avatar). Por defecto 'md'.
 * @property showName  - Si es false, solo muestra el avatar sin nombre ni rol. Por defecto true.
 */
interface UserAvatarProps {
  /** User to display. */
  user: {
    name: string;
    email?: string;
    avatarUrl?: string | null;
  };
  /** Optional role shown below the name. */
  role?: TeamRole | null;
  /** Avatar size. */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the user name next to the avatar. */
  showName?: boolean;
}

/**
 * UserAvatar — combina el Avatar con el nombre del usuario y su rol o email opcionales.
 *
 * Consolida el patrón "avatar + info de usuario" que se repite en listas de miembros,
 * campos de asignado y secciones de equipo, garantizando presentación consistente.
 *
 * Lógica de información secundaria (prioridad):
 * 1. Si hay `role` → muestra el rol en inglés (terminología estándar Scrum).
 * 2. Si no hay `role` pero sí `email` → muestra el email como identificador alternativo.
 * 3. Si no hay ninguno → solo el nombre.
 *
 * @example
 * // Con rol (típico en listas de miembros del equipo)
 * <UserAvatar user={member.user} role={member.role} size="sm" />
 *
 * // Solo avatar sin texto (útil en chips compactos)
 * <UserAvatar user={assignee} showName={false} size="xs" />
 */
export function UserAvatar({ user, role, size = 'md', showName = true }: UserAvatarProps) {
  return (
    <div className={styles.wrapper}>
      {/* Delega la lógica de imagen/iniciales/color al átomo Avatar */}
      <Avatar name={user.name} avatarUrl={user.avatarUrl} size={size} />
      {showName && (
        <div className={styles.info}>
          <span className={styles.name}>{user.name}</span>
          {/* Si hay rol, tiene prioridad sobre el email como información secundaria */}
          {role && (
            <span className={styles.role}>{ROLE_LABELS[role]}</span>
          )}
          {/* Fallback: muestra el email cuando no hay rol definido */}
          {!role && user.email && (
            <span className={styles.email}>{user.email}</span>
          )}
        </div>
      )}
    </div>
  );
}
