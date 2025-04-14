import { useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  GET_NOTIFICATIONS,
  MARK_NOTIFICATION_READ,
  MARK_ALL_NOTIFICATIONS_READ,
} from '@/graphql/notification/notification.operations';
import { Button } from '@/components/atoms/Button/Button';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { formatRelativeTime } from '@/utils/date.utils';
import styles from './NotificationPanel.module.scss';

/**
 * Estructura de una notificación individual tal como la devuelve el backend.
 * `payload` es un JSON serializado como string que contiene datos contextuales
 * (nombre del sprint, título de la historia, etc.) según el tipo de notificación.
 */
interface Notification {
  id: string;
  type: string;
  payload: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * Convierte el tipo de notificación y su payload en un mensaje legible.
 *
 * El payload es un JSON string con datos contextuales variables según el tipo,
 * por lo que se parsea y se accede con tipo genérico `Record<string, string>`.
 * Si el parseo falla o el tipo no está mapeado, se formatea el tipo como texto
 * plano sustituyendo guiones bajos por espacios.
 *
 * @param type    - Identificador del tipo de notificación (p.ej. 'SPRINT_STARTED').
 * @param payload - JSON string con datos contextuales, o null si no hay datos.
 * @returns Mensaje legible en español para mostrar al usuario.
 */
function getNotificationLabel(type: string, payload: string | null): string {
  try {
    const data = payload ? (JSON.parse(payload) as Record<string, string>) : {};
    switch (type) {
      case 'SPRINT_STARTED': return `Sprint "${data.sprintName ?? ''}" iniciado`;
      case 'SPRINT_CLOSED': return `Sprint "${data.sprintName ?? ''}" cerrado`;
      case 'STORY_ASSIGNED': return `Se te asignó la historia "${data.storyTitle ?? ''}"`;
      case 'COMMENT_ADDED': return `Nuevo comentario en "${data.storyTitle ?? ''}"`;
      case 'MEMBER_INVITED': return `Fuiste añadido al equipo "${data.teamName ?? ''}"`;
      // Fallback para tipos no mapeados: muestra el tipo como texto legible
      default: return type.replace(/_/g, ' ').toLowerCase();
    }
  } catch {
    // Si el JSON es inválido, retorna el tipo crudo como último recurso
    return type;
  }
}

/**
 * Props del componente NotificationPanel.
 *
 * @property anchorRef - Ref al botón que abrió el panel, usado para calcular la posición.
 * @property onClose   - Callback para cerrar el panel (clic fuera o cierre por acción).
 */
interface NotificationPanelProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}

/**
 * NotificationPanel — panel desplegable de notificaciones del usuario.
 *
 * Se renderiza mediante portal en `document.body` y se posiciona dinámicamente
 * debajo del botón de campana (`anchorRef`) usando coordenadas del viewport.
 * Esto evita problemas de z-index y overflow en el AppHeader.
 *
 * Comportamiento:
 * - Carga las últimas 20 notificaciones con `cache-and-network` para mostrar
 *   datos cacheados inmediatamente y luego refrescar con datos frescos.
 * - Hacer clic en una notificación no leída la marca como leída via mutation,
 *   refrescando tanto la lista como el conteo del badge en el header.
 * - "Marcar todas como leídas" llama a una mutation masiva.
 * - Clic fuera del panel o del botón de campana → `onClose`.
 *
 * El panel solo muestra el spinner en la primera carga (cuando no hay datos en caché).
 * En refetches posteriores, los datos anteriores siguen visibles sin spinner.
 *
 * @example
 * {showNotifications && (
 *   <NotificationPanel anchorRef={bellRef} onClose={() => setShowNotifications(false)} />
 * )}
 */
export function NotificationPanel({ anchorRef, onClose }: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  // cache-and-network: muestra datos cacheados de inmediato y refresca en segundo plano
  const { data, loading } = useQuery<{ notifications: Notification[] }>(GET_NOTIFICATIONS, {
    variables: { limit: 20 },
    fetchPolicy: 'cache-and-network',
  });

  // Marcar una notificación individual como leída y refrescar el conteo del badge
  const [markRead] = useMutation<any>(MARK_NOTIFICATION_READ, {
    refetchQueries: ['GetNotifications', 'GetUnreadNotificationCount'],
  });

  // Marcar todas las notificaciones como leídas de una vez
  const [markAll, { loading: markingAll }] = useMutation<any>(MARK_ALL_NOTIFICATIONS_READ, {
    refetchQueries: ['GetNotifications', 'GetUnreadNotificationCount'],
  });

  // Cierra el panel cuando el usuario hace clic fuera (ni en el panel ni en el anchor)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, anchorRef]);

  const notifications = data?.notifications ?? [];
  // Cuenta las notificaciones sin leer para el badge del encabezado del panel
  const unread = notifications.filter((n) => !n.readAt);

  function handleNotificationClick(n: Notification) {
    // Solo llama a la mutation si la notificación aún no ha sido leída
    if (!n.readAt) {
      markRead({ variables: { id: n.id } });
    }
  }

  // Posiciona el panel justo debajo del botón de campana
  const anchor = anchorRef.current?.getBoundingClientRect();
  const top = anchor ? anchor.bottom + 8 : 64; // 8px de separación; 64px fallback
  // right se calcula desde el borde derecho del viewport para alinear el panel con el botón
  const right = anchor ? window.innerWidth - anchor.right : 16;

  return createPortal(
    <div
      ref={panelRef}
      className={styles.panel}
      style={{ top, right }}
      role="dialog"
      aria-label={t('notifications.title')}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>
          {t('notifications.title')}
          {/* Badge con el conteo de no leídas — solo visible cuando hay alguna */}
          {unread.length > 0 && (
            <span className={styles.unreadBadge}>{unread.length}</span>
          )}
        </h3>
        {/* Botón "marcar todas como leídas" — solo visible cuando hay no leídas */}
        {unread.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAll()}
            loading={markingAll}
          >
            {t('notifications.markAllRead')}
          </Button>
        )}
      </div>

      <div className={styles.body}>
        {/* Spinner solo en la primera carga, cuando aún no hay datos en caché */}
        {loading && notifications.length === 0 && (
          <div className={styles.empty}><Spinner size="sm" /></div>
        )}

        {/* Estado vacío — visible cuando la carga terminó y no hay notificaciones */}
        {!loading && notifications.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🔔</span>
            <p>{t('notifications.empty')}</p>
          </div>
        )}

        {/* Lista de notificaciones */}
        {notifications.map((n) => (
          <button
            key={n.id}
            // El modificador 'item--unread' añade el punto azul y el fondo diferenciado
            className={`${styles.item} ${!n.readAt ? styles['item--unread'] : ''}`}
            onClick={() => handleNotificationClick(n)}
          >
            <div className={styles.itemContent}>
              <span className={styles.itemText}>{getNotificationLabel(n.type, n.payload)}</span>
              {/* Tiempo relativo (p.ej. "hace 5 minutos") calculado por la utilidad de fechas */}
              <span className={styles.itemTime}>{formatRelativeTime(n.createdAt)}</span>
            </div>
            {/* Punto indicador de "no leída" — decorativo, el estado ya está en el fondo */}
            {!n.readAt && <span className={styles.dot} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
