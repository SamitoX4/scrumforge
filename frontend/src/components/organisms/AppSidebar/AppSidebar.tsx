import { NavLink, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import styles from './AppSidebar.module.scss';
import { useUIStore } from '@/store/ui.store';
import { buildRoute, ROUTES } from '@/constants/routes';
import { WorkspaceSelector } from '@/features/workspace/components/WorkspaceSelector';
import { frontendExtensionRegistry } from '@/extensions/extension-registry';

/**
 * Items de navegación del core — siempre disponibles independientemente
 * de qué extensiones estén cargadas.
 *
 * Wiki y automation NO están aquí — son aportados por las extensiones
 * 'wiki' y 'ai' respectivamente (F2 ✅, F5 ✅).
 *
 * Se define como constante de módulo para evitar recrear el array en cada render.
 */
const CORE_NAV = [
  { icon: '📋', key: 'backlog',        navKey: 'nav.backlog',        route: ROUTES.BACKLOG },
  { icon: '🗂',  key: 'board',          navKey: 'nav.board',          route: ROUTES.BOARD },
  { icon: '🚀',  key: 'planning',       navKey: 'nav.planning',       route: ROUTES.SPRINT_PLANNING },
  { icon: '🚧',  key: 'impediments',    navKey: 'nav.impediments',    route: ROUTES.IMPEDIMENTS },
  { icon: '🔄',  key: 'retrospectives', navKey: 'nav.retrospectives', route: ROUTES.RETROSPECTIVES },
  { icon: '📊',  key: 'reports',        navKey: 'nav.reports',        route: ROUTES.REPORTS },
] as const;

/**
 * Settings siempre al final, independientemente de las extensiones cargadas.
 * Se renderiza por separado de los items principales para garantizar que
 * siempre aparezca al final de la navegación del proyecto.
 */
const SETTINGS_NAV = { icon: '⚙️', key: 'settings', navKey: 'nav.settings', route: ROUTES.PROJECT_SETTINGS } as const;

/**
 * AppSidebar — barra de navegación lateral de la aplicación.
 *
 * Maneja dos contextos de navegación distintos:
 *
 * 1. **Con proyecto activo** (`projectId` y `workspaceSlug` presentes en la URL):
 *    Muestra los items de navegación del proyecto (backlog, board, planning, etc.)
 *    combinando los items del core con los aportados por extensiones registradas.
 *    Settings del proyecto se renderiza siempre al final.
 *
 * 2. **Sin proyecto** (solo `workspaceSlug`):
 *    Muestra navegación de workspace: Dashboard y configuración de workspace.
 *
 * El estado de colapso (expandido/colapsado) se lee desde el store global de UI
 * para que otros componentes (como el AppHeader) puedan controlarlo.
 *
 * Cuando el sidebar está colapsado:
 * - Solo se muestra el icono de cada item (no el label).
 * - El `title` del NavLink sirve de tooltip para identificar el destino.
 * - El logo se reduce a un icono.
 *
 * El sistema de extensiones permite que módulos opcionales (wiki, IA) inyecten
 * sus propios items de navegación sin modificar este componente.
 */
export function AppSidebar() {
  const { sidebarCollapsed } = useUIStore();
  // Parámetros de URL para construir rutas contextualizadas al workspace/proyecto activo
  const { projectId, workspaceSlug } = useParams<{ projectId: string; workspaceSlug: string }>();
  const { t } = useTranslation();

  // Construye la ruta del dashboard del workspace actual (fallback a raíz si no hay slug)
  const dashboardRoute = workspaceSlug
    ? buildRoute(ROUTES.DASHBOARD, { workspaceSlug })
    : '/';
  const workspaceSettingsRoute = workspaceSlug
    ? buildRoute(ROUTES.WORKSPACE_SETTINGS, { workspaceSlug })
    : '/';

  // Combina items del core con los registrados por extensiones (wiki, IA, etc.)
  // Settings se excluye aquí porque se renderiza aparte al final
  const mainNavItems = [
    ...CORE_NAV,
    ...frontendExtensionRegistry.getNavItems(),
  ];

  return (
    <aside className={clsx(styles.sidebar, sidebarCollapsed && styles['sidebar--collapsed'])}>
      {/* Logo: texto completo cuando expandido, icono cuando colapsado */}
      <div className={styles.logo}>
        {sidebarCollapsed ? (
          <span className={styles['logo__icon']}>⚒</span>
        ) : (
          <span className={styles['logo__text']}>ScrumForge</span>
        )}
      </div>

      {/* Selector de workspace — permite cambiar de workspace sin salir de la app */}
      <WorkspaceSelector collapsed={sidebarCollapsed} />

      {/* Navegación de proyecto — solo visible cuando hay projectId y workspaceSlug en la URL */}
      {projectId && workspaceSlug && (
        <nav className={styles.nav} aria-label={t('nav.dashboard')}>
          {mainNavItems.map(({ icon, key, navKey, route }) => {
            const label = t(navKey);
            return (
              <NavLink
                key={key}
                to={buildRoute(route, { workspaceSlug, projectId })}
                // NavLink añade la clase active automáticamente cuando la ruta coincide
                className={({ isActive }) =>
                  clsx(styles['nav__item'], isActive && styles['nav__item--active'])
                }
                // title como tooltip solo cuando el sidebar está colapsado y no hay label visible
                title={sidebarCollapsed ? label : undefined}
              >
                <span className={styles['nav__icon']}>{icon}</span>
                {/* El label solo se muestra cuando el sidebar está expandido */}
                {!sidebarCollapsed && <span className={styles['nav__label']}>{label}</span>}
              </NavLink>
            );
          })}
          {/* Settings siempre se renderiza al final, separado de los items de extensiones */}
          <NavLink
            key={SETTINGS_NAV.key}
            to={buildRoute(SETTINGS_NAV.route, { workspaceSlug, projectId })}
            className={({ isActive }) =>
              clsx(styles['nav__item'], isActive && styles['nav__item--active'])
            }
            title={sidebarCollapsed ? t(SETTINGS_NAV.navKey) : undefined}
          >
            <span className={styles['nav__icon']}>{SETTINGS_NAV.icon}</span>
            {!sidebarCollapsed && <span className={styles['nav__label']}>{t(SETTINGS_NAV.navKey)}</span>}
          </NavLink>
        </nav>
      )}

      {/* Navegación de workspace — solo visible cuando NO hay proyecto activo en la URL */}
      {!projectId && (
        <nav className={styles.nav}>
          <NavLink
            to={dashboardRoute}
            className={({ isActive }) =>
              clsx(styles['nav__item'], isActive && styles['nav__item--active'])
            }
          >
            <span className={styles['nav__icon']}>🏠</span>
            {!sidebarCollapsed && <span className={styles['nav__label']}>{t('nav.dashboard')}</span>}
          </NavLink>
          <NavLink
            to={workspaceSettingsRoute}
            className={({ isActive }) =>
              clsx(styles['nav__item'], isActive && styles['nav__item--active'])
            }
            title={sidebarCollapsed ? t('nav.workspace') : undefined}
          >
            <span className={styles['nav__icon']}>⚙️</span>
            {!sidebarCollapsed && <span className={styles['nav__label']}>{t('nav.workspace')}</span>}
          </NavLink>
        </nav>
      )}
    </aside>
  );
}
