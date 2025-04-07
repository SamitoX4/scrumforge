/**
 * @file App.tsx
 * @description Raíz de la aplicación React.
 *
 * Define la estructura global de rutas mediante React Router v6 y envuelve
 * toda la aplicación en el `ApolloProvider` para que cualquier componente
 * hijo pueda hacer queries/mutations GraphQL sin prop-drilling.
 *
 * Estrategia de carga:
 * - Todas las páginas son lazy-loaded para reducir el bundle inicial.
 * - Los layouts (WorkspaceLayout, PublicLayout) se cargan de forma síncrona
 *   porque son pequeños y se usan en casi todas las rutas.
 *
 * Estrategia de rutas:
 * - Rutas públicas: accesibles sin autenticación; redirigen al dashboard si
 *   el usuario ya tiene sesión activa.
 * - Rutas protegidas: bajo `/:workspaceSlug`, gestionadas por WorkspaceLayout
 *   que verifica autenticación y verificación de email.
 * - Rutas de flujo de auth (verify-email, reset-password, etc.): accesibles
 *   independientemente del estado de autenticación.
 */
// src/App.tsx
import { lazy, Suspense, useEffect } from 'react';
import { frontendExtensionRegistry } from '@/extensions/extension-registry';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { gql } from '@apollo/client';
import { ApolloProvider, useQuery } from '@apollo/client/react';
import { apolloClient } from '@/graphql/client';
import { useAuthStore } from '@/store/auth.store';
import { ROUTES } from '@/constants/routes';

/**
 * Query ligera usada únicamente para resolver la redirección inicial.
 * Solo se pide `slug` para minimizar el payload de red.
 */
const GET_WORKSPACES_QUERY = gql`
  query GetWorkspacesForRedirect {
    workspaces { slug }
  }
`;
import { AppSidebar } from '@/components/organisms/AppSidebar/AppSidebar';
import { AppHeader } from '@/components/organisms/AppHeader/AppHeader';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import { useUIStore } from '@/store/ui.store';
import { ToastContainer } from '@/components/organisms/ToastContainer/ToastContainer';
import { CommandPalette } from '@/components/organisms/CommandPalette/CommandPalette';
import { OnboardingTooltips } from '@/features/onboarding/OnboardingTooltips';
import { useNotifications } from '@/hooks/useNotifications';
import { useCurrentWorkspace } from '@/hooks/useCurrentWorkspace';
import '@/styles/global.scss';
import '@/i18n/i18n';
import clsx from 'clsx';
import styles from './App.module.scss';

// ── Lazy-loaded pages ─────────────────────────────────────────────────────────
// Cada import dinámico genera un chunk separado en Vite, reduciendo el JS
// inicial y mejorando el TTI (Time To Interactive).
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const VerifyEmailPage = lazy(() => import('@/pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const AcceptInvitationPage = lazy(() => import('@/pages/AcceptInvitationPage'));
const OnboardingPage = lazy(() => import('@/features/onboarding/OnboardingPage'));
const PricingPage = lazy(() => import('@/pages/PricingPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const BacklogPage = lazy(() => import('@/pages/BacklogPage'));
const BoardPage = lazy(() => import('@/pages/BoardPage'));
const SprintPlanningPage = lazy(() => import('@/pages/SprintPlanningPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const ProjectSettingsPage = lazy(() => import('@/pages/ProjectSettingsPage'));
const WorkspaceSettingsPage = lazy(() => import('@/pages/WorkspaceSettingsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const OAuthCallbackPage = lazy(() => import('@/pages/OAuthCallbackPage'));
const ImpedimentsPage = lazy(() => import('@/pages/ImpedimentsPage'));
const RetrospectivesPage = lazy(() => import('@/pages/RetrospectivesPage'));

/**
 * Indicador de carga global mostrado mientras se descarga el chunk de una página.
 * Centra un spinner grande en pantalla para evitar un flash en blanco.
 */
function PageLoader() {
  return (
    <div className={styles.loader}>
      <Spinner size="lg" />
    </div>
  );
}

/**
 * WorkspaceLayout — layout principal para todas las rutas protegidas.
 *
 * Responsabilidades:
 * - Verificar autenticación; redirige a /login si no hay sesión.
 * - Bloquear acceso si el email no está verificado.
 * - Cargar el workspace actual a partir del slug en la URL.
 * - Registrar el listener global de Ctrl+K para la paleta de comandos.
 * - Activar la suscripción de notificaciones en tiempo real para toda la sesión.
 * - Renderizar la estructura de chrome (sidebar + header + contenido principal).
 * - Soportar modo Zen (sin sidebar ni header) para máxima concentración.
 */
function WorkspaceLayout() {
  const { isAuthenticated, user } = useAuthStore();
  const { sidebarCollapsed, commandPaletteOpen, openCommandPalette, closeCommandPalette, zenMode } = useUIStore();
  const { loading: workspaceLoading } = useCurrentWorkspace();

  // Real-time notifications via WebSocket (active for the whole session)
  useNotifications();

  // Global Ctrl+K shortcut — must be declared before any conditional returns
  // Se declara aquí (no en los hooks condicionales) para cumplir las reglas de hooks.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Soportar tanto Ctrl (Windows/Linux) como Cmd (macOS) para abrir la paleta
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (commandPaletteOpen) {
          closeCommandPalette();
        } else {
          openCommandPalette();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    // Limpiar el listener al desmontar o cuando cambien las dependencias
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, openCommandPalette, closeCommandPalette]);

  // Redirigir a login si no hay sesión activa
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />;

  // Block access until email is verified (only when explicitly false, not undefined from old sessions)
  // Se comprueba `=== false` y no solo `!user.emailVerified` para no bloquear
  // sesiones antiguas que no tenían este campo en el store persistido.
  if (user && user.emailVerified === false) {
    return <Navigate to={ROUTES.VERIFY_EMAIL} replace />;
  }

  return (
    <div className={clsx(
      styles.appLayout,
      // Clase CSS para ancho reducido del sidebar cuando está colapsado
      sidebarCollapsed && styles['appLayout--collapsed'],
      // Clase CSS para ocultar chrome completo en modo Zen
      zenMode && styles['appLayout--zen'],
    )}>
      {/* En modo Zen se ocultan sidebar y header para maximizar el área de trabajo */}
      {!zenMode && <AppSidebar />}
      {!zenMode && <AppHeader />}
      <main className={clsx(styles.content, zenMode && styles['content--zen'])}>
        {/* Suspense muestra el loader mientras se descarga el chunk de la página */}
        <Suspense fallback={<PageLoader />}>
          {/* Esperar también a que el workspace cargue para evitar renders con datos parciales */}
          {workspaceLoading ? <PageLoader /> : <Outlet />}
        </Suspense>
      </main>
      {/* Toasts globales, siempre visibles por encima del contenido */}
      <ToastContainer />
      {/* Paleta de comandos montada condicionalmente para no renderizar su lógica de búsqueda cuando no está visible */}
      {commandPaletteOpen && <CommandPalette />}
      <OnboardingTooltips />
    </div>
  );
}

/**
 * WorkspaceRedirect — resuelve el destino de un usuario autenticado sin slug conocido.
 *
 * Consulta la lista de workspaces y envía al usuario a:
 * - El primer workspace disponible (slug), si existe.
 * - La página de onboarding si aún no tiene ningún workspace creado.
 *
 * Usa `fetchPolicy: 'network-only'` implícita de Apollo para garantizar datos frescos.
 */
function WorkspaceRedirect() {
  const { data, loading } = useQuery<{ workspaces: Array<{ slug: string }> }>(
    GET_WORKSPACES_QUERY,
  );
  if (loading) return <PageLoader />;
  const first = data?.workspaces?.[0];
  return first
    ? <Navigate to={`/${first.slug}`} replace />
    : <Navigate to={ROUTES.ONBOARDING} replace />;
}

/**
 * PublicLayout — wrapper para rutas públicas (login, registro).
 *
 * Si el usuario ya está autenticado lo redirige al dashboard de su workspace,
 * evitando que vea la pantalla de login innecesariamente.
 * Si no hay slug conocido en el store, lanza una query ligera para determinarlo.
 */
function PublicLayout() {
  const { isAuthenticated, currentWorkspaceSlug } = useAuthStore();
  if (isAuthenticated) {
    // Usar el slug cacheado en el store para una redirección instantánea sin red
    if (currentWorkspaceSlug) return <Navigate to={`/${currentWorkspaceSlug}`} replace />;
    // Sin slug cacheado, consultar el servidor
    return <WorkspaceRedirect />;
  }
  return <Suspense fallback={<PageLoader />}><Outlet /></Suspense>;
}

/**
 * RootRedirect — maneja la ruta raíz `/`.
 *
 * Envía al usuario autenticado a su último workspace o, si no hay ninguno,
 * al flujo de onboarding. Los usuarios no autenticados van al login.
 */
function RootRedirect() {
  const { isAuthenticated, currentWorkspaceSlug } = useAuthStore();
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />;
  if (currentWorkspaceSlug) return <Navigate to={`/${currentWorkspaceSlug}`} replace />;
  return <WorkspaceRedirect />;
}

/**
 * ThemeApplier — componente auxiliar sin UI que sincroniza el tema del store
 * con el atributo `data-theme` del elemento `<html>`.
 *
 * Las variables CSS globales en `_variables.scss` se activan según este atributo,
 * por lo que basta con cambiarlo para que toda la app cambie de tema sin re-render.
 * Retorna null para no añadir nodos DOM adicionales.
 */
function ThemeApplier() {
  const { theme } = useUIStore();
  useEffect(() => {
    // El atributo data-theme es leído por los selectores CSS [data-theme="dark"]
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  return null;
}

/**
 * App — componente raíz de la aplicación.
 *
 * Estructura:
 * - `ApolloProvider`: expone el cliente GraphQL a todo el árbol.
 * - `ThemeApplier`: sincroniza el tema sin UI propia.
 * - `BrowserRouter` + `Routes`: define el árbol de rutas.
 *
 * Orden de las rutas (importa porque React Router evalúa de arriba a abajo):
 * 1. Raíz exacta `/`
 * 2. Rutas públicas (login, registro)
 * 3. Callback OAuth (siempre accesible)
 * 4. Flujos de auth sin sesión requerida (verify-email, reset-password, etc.)
 * 5. Onboarding y pricing (auth pero sin workspace)
 * 6. Rutas protegidas bajo `/:workspaceSlug`
 * 7. Ruta 404 catch-all
 */
export default function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <ThemeApplier />
      <BrowserRouter>
        <Routes>
            {/* Root redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Public */}
            <Route element={<PublicLayout />}>
              <Route path={ROUTES.LOGIN} element={<LoginPage />} />
              <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
            </Route>

            {/* OAuth callback — must be accessible regardless of auth state */}
            <Route path={ROUTES.AUTH_CALLBACK} element={<Suspense fallback={<PageLoader />}><OAuthCallbackPage /></Suspense>} />

            {/* Public — auth flows (accessible regardless of auth state) */}
            <Route path={ROUTES.VERIFY_EMAIL} element={<Suspense fallback={<PageLoader />}><VerifyEmailPage /></Suspense>} />
            <Route path={ROUTES.FORGOT_PASSWORD} element={<Suspense fallback={<PageLoader />}><ForgotPasswordPage /></Suspense>} />
            <Route path={ROUTES.RESET_PASSWORD} element={<Suspense fallback={<PageLoader />}><ResetPasswordPage /></Suspense>} />
            <Route path={ROUTES.ACCEPT_INVITATION} element={<Suspense fallback={<PageLoader />}><AcceptInvitationPage /></Suspense>} />

            {/* Onboarding & Pricing — accessible if authenticated but without workspace */}
            <Route path={ROUTES.ONBOARDING} element={<Suspense fallback={<PageLoader />}><OnboardingPage /></Suspense>} />
            <Route path={ROUTES.PRICING} element={<Suspense fallback={<PageLoader />}><PricingPage /></Suspense>} />

            {/* Protected multi-tenant */}
            <Route path="/:workspaceSlug" element={<WorkspaceLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="projects/:projectId/backlog" element={<BacklogPage />} />
              <Route path="projects/:projectId/planning" element={<SprintPlanningPage />} />
              <Route path="projects/:projectId/board" element={<BoardPage />} />
              <Route path="projects/:projectId/reports" element={<ReportsPage />} />
              <Route path="projects/:projectId/settings" element={<ProjectSettingsPage />} />
              <Route path="projects/:projectId/impediments" element={<ImpedimentsPage />} />
              <Route path="projects/:projectId/retrospectives" element={<RetrospectivesPage />} />
              <Route path="settings" element={<WorkspaceSettingsPage />} />
              {/* Rutas registradas por extensiones premium */}
              {frontendExtensionRegistry.getRoutes().map(({ path, component: Comp }) => (
                <Route
                  key={path}
                  path={path}
                  element={<Suspense fallback={<PageLoader />}><Comp /></Suspense>}
                />
              ))}
            </Route>

            <Route path="/404" element={<NotFoundPage />} />
            <Route path={ROUTES.NOT_FOUND} element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ApolloProvider>
  );
}
