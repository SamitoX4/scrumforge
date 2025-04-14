import { useState, useRef } from 'react';
import { useQuery } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import styles from './AppHeader.module.scss';
import { useUIStore } from '@/store/ui.store';
import { useAuth } from '@/hooks/useAuth';
import { Avatar } from '@/components/atoms/Avatar/Avatar';
import { Button } from '@/components/atoms/Button/Button';
import { NotificationPanel } from '@/components/organisms/NotificationPanel/NotificationPanel';
import { LanguageSwitcher } from '@/components/molecules/LanguageSwitcher/LanguageSwitcher';
import { GET_UNREAD_COUNT } from '@/graphql/notification/notification.operations';

/**
 * Detección de plataforma Mac para mostrar el atajo de teclado correcto.
 * Se evalúa una sola vez al cargar el módulo (no en cada render) porque
 * `navigator.platform` es estático durante la sesión del navegador.
 * La guarda `typeof navigator !== 'undefined'` evita errores en SSR.
 */
const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);

/**
 * AppHeader — barra de encabezado global de la aplicación autenticada.
 *
 * Contiene los controles globales de la interfaz:
 * - **Toggle de sidebar**: colapsa/expande el menú lateral.
 * - **Búsqueda global**: abre la CommandPalette (acceso rápido Cmd/Ctrl+K).
 * - **Campana de notificaciones**: muestra el conteo de no leídas y abre el panel.
 * - **Toggle de tema**: alterna entre modo claro y oscuro.
 * - **Selector de idioma**: alterna entre español e inglés.
 * - **Menú de usuario**: avatar, nombre y botón de cerrar sesión.
 *
 * El conteo de notificaciones no leídas se refresca automáticamente cada 30 segundos
 * mediante `pollInterval` en lugar de una suscripción WebSocket, para mantener
 * bajo el número de conexiones activas en el header (que siempre está montado).
 *
 * El badge de notificaciones muestra "9+" cuando el conteo supera 9, evitando
 * que el badge se desborde visualmente con números grandes.
 */
export function AppHeader() {
  const { toggleSidebar, openCommandPalette, theme, toggleTheme } = useUIStore();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  // Controla la visibilidad del panel de notificaciones
  const [showNotifications, setShowNotifications] = useState(false);
  // Ref al botón de campana para que NotificationPanel pueda posicionarse bajo él
  const bellRef = useRef<HTMLButtonElement>(null);

  // Polling cada 30 segundos — evita subscripción permanente para un dato poco crítico
  const { data } = useQuery<{ unreadNotificationCount: number }>(GET_UNREAD_COUNT, {
    pollInterval: 30000,
  });
  // Si la query falla o aún no ha resuelto, el conteo es 0
  const unreadCount = data?.unreadNotificationCount ?? 0;

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {/* Toggle del sidebar — alterna entre expandido y colapsado */}
        <button
          className={styles['toggle-btn']}
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          ☰
        </button>

        {/* Botón de búsqueda global — abre la CommandPalette */}
        <button
          className={styles['search-btn']}
          onClick={openCommandPalette}
          aria-label="Búsqueda global"
        >
          <span className={styles['search-icon']}>🔍</span>
          <span className={styles['search-text']}>{t('common.search')}...</span>
          {/* El atajo de teclado se adapta según la plataforma detectada al inicio */}
          <kbd className={styles['search-kbd']}>{isMac ? '⌘K' : 'Ctrl+K'}</kbd>
        </button>
      </div>

      <div className={styles.right}>
        {/* Botón de notificaciones con badge de no leídas */}
        <button
          ref={bellRef}
          className={styles['bell-btn']}
          onClick={() => setShowNotifications((v) => !v)}
          // El aria-label incluye el conteo para informar a lectores de pantalla
          aria-label={`${t('notifications.title')}${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
        >
          🔔
          {/* Badge numérico — solo visible cuando hay notificaciones no leídas */}
          {unreadCount > 0 && (
            <span className={styles['bell-badge']} aria-hidden="true">
              {/* Limita el número a "9+" para evitar desbordamiento visual */}
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Panel de notificaciones — se ancla bajo el botón de campana via ref */}
        {showNotifications && (
          <NotificationPanel
            anchorRef={bellRef}
            onClose={() => setShowNotifications(false)}
          />
        )}

        {/* Toggle de tema claro/oscuro */}
        <button
          className={styles['theme-btn']}
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? t('settings.general') : t('settings.general')}
        >
          {/* El icono refleja el tema activo: sol en oscuro, luna en claro */}
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* Selector de idioma ES/EN */}
        <LanguageSwitcher />

        {/* Menú de usuario — solo visible cuando hay sesión activa */}
        {user && (
          <div className={styles['user-menu']}>
            <Avatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
            <span className={styles['user-name']}>{user.name}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              {t('common.logout')}
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
