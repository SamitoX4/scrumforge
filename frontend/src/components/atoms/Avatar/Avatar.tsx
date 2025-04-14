import clsx from 'clsx';
import styles from './Avatar.module.scss';

/**
 * Props del componente Avatar.
 * Permite mostrar una imagen de perfil real o, en su defecto,
 * un placeholder con las iniciales del usuario sobre un fondo de color.
 */
interface AvatarProps {
  /** Nombre completo del usuario — se usa para las iniciales y como alt text. */
  name: string;
  /** URL de la imagen de perfil. Si es null o undefined se muestran las iniciales. */
  avatarUrl?: string | null;
  /** Tamaño visual del avatar. Por defecto 'md'. */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Clases CSS adicionales para el elemento raíz. */
  className?: string;
}

/**
 * Extrae hasta dos iniciales del nombre completo.
 * Se toman la primera letra del primer nombre y la primera del segundo
 * (si existe), y se convierten a mayúsculas.
 * Ejemplo: "Juan Pérez" → "JP", "Ana" → "A"
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)          // máximo dos palabras para no saturar el avatar
    .map((w) => w[0])     // primera letra de cada palabra
    .join('')
    .toUpperCase();
}

/**
 * Asigna un color de fondo determinista a partir del nombre del usuario.
 * Usa el código ASCII del primer carácter como índice en una paleta fija,
 * garantizando que el mismo usuario siempre reciba el mismo color
 * sin necesidad de almacenarlo en la base de datos.
 */
function getColorFromName(name: string): string {
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4'];
  // El módulo garantiza que el índice nunca supere los límites del array
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

/**
 * Avatar — muestra la foto de perfil de un usuario o sus iniciales como fallback.
 *
 * Renderiza un `<img>` cuando hay URL disponible y un `<span>` con iniciales
 * cuando no la hay. El color de fondo del fallback es determinista basado en
 * el nombre, por lo que es consistente entre recargas y sin estado extra.
 *
 * @example
 * // Con imagen de perfil
 * <Avatar name="Ana López" avatarUrl="https://..." size="lg" />
 *
 * // Sin imagen — muestra "AL" sobre fondo de color
 * <Avatar name="Ana López" size="sm" />
 */
export function Avatar({ name, avatarUrl, size = 'md', className }: AvatarProps) {
  // Si hay URL de avatar, renderizar la imagen directamente
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={clsx(styles.avatar, styles[`avatar--${size}`], className)}
      />
    );
  }

  // Fallback: círculo de color con las iniciales del usuario
  return (
    <span
      className={clsx(styles.avatar, styles[`avatar--${size}`], styles['avatar--initials'], className)}
      style={{ backgroundColor: getColorFromName(name) }}
      title={name}
    >
      {getInitials(name)}
    </span>
  );
}
