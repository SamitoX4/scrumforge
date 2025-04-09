/**
 * @file OAuthCallbackPage.tsx
 * @description Página de callback para el flujo de autenticación OAuth (Google).
 *
 * Esta página actúa como receptor del redirect del backend tras el handshake OAuth.
 * El backend, una vez completada la autenticación con el proveedor (Google), redirige
 * al usuario a esta ruta con todos los datos de sesión codificados como query params.
 *
 * Flujo completo:
 * 1. El usuario hace clic en "Iniciar sesión con Google" en `LoginForm`.
 * 2. El navegador va al endpoint OAuth del backend (Passport.js).
 * 3. El backend redirige a Google, el usuario autoriza.
 * 4. Google redirige de vuelta al backend con el código de autorización.
 * 5. El backend intercambia el código por tokens, crea/actualiza el usuario en BD,
 *    y redirige a ESTA página con los tokens y datos del usuario como query params.
 * 6. Esta página extrae los params, los guarda en el auth store y Apollo,
 *    y redirige al workspace del usuario (o al onboarding si no tiene ninguno).
 *
 * El renderizado es solo un spinner de pantalla completa, ya que el procesamiento
 * ocurre en el `useEffect` al montar y la navegación es inmediata.
 *
 * Seguridad: si algún param obligatorio falta o hay un error explícito, se redirige
 * al login con `?error=oauth_failed` para que `LoginForm` muestre el mensaje apropiado.
 */

import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { apolloClient } from '@/graphql/client';
import { GET_WORKSPACES } from '@/graphql/workspace/workspace.queries';
import { ROUTES } from '@/constants/routes';
import { Spinner } from '@/components/atoms/Spinner/Spinner';
import type { Workspace } from '@/types/api.types';

/**
 * Página de callback OAuth. Procesa los tokens recibidos del backend tras la
 * autenticación con Google y redirige al destino apropiado.
 *
 * No renderiza contenido visible (solo un spinner) porque su única función
 * es procesar los query params y navegar a otra ruta lo más rápido posible.
 *
 * @returns JSX con un spinner centrado en pantalla completa durante el procesamiento.
 */
export default function OAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    // Extraer todos los parámetros que el backend envía en el redirect OAuth
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const userId = params.get('userId');
    const name = params.get('name');
    const email = params.get('email');
    const avatarUrl = params.get('avatarUrl'); // Puede ser null si el proveedor no lo proporciona
    const error = params.get('error');         // Presente si el backend encontró un problema

    // Validar que todos los campos obligatorios están presentes antes de proceder.
    // Si falta cualquiera o hay un error explícito del backend, abortar y redirigir al login.
    // Usar `replace: true` para que el usuario no pueda volver a esta página con el botón atrás.
    if (error || !accessToken || !refreshToken || !userId || !name || !email) {
      navigate(ROUTES.LOGIN + '?error=oauth_failed', { replace: true });
      return;
    }

    // Guardar el estado de autenticación en Zustand.
    // `emailVerified: true` porque OAuth garantiza que el email está verificado
    // por el proveedor (Google confirma la propiedad del correo).
    // `createdAt` se establece con la fecha actual como aproximación, ya que el
    // backend no lo incluye en el redirect para mantener los params breves.
    setAuth(
      { id: userId, name, email, avatarUrl: avatarUrl ?? null, emailVerified: true, createdAt: new Date().toISOString() },
      accessToken,
      refreshToken,
    );

    // Consultar los workspaces usando `network-only` para evitar datos de caché
    // de una sesión anterior que pudiera seguir en memoria.
    // Redirigir al primer workspace si existe, o al onboarding si el usuario es nuevo.
    apolloClient
      .query<{ workspaces: Workspace[] }>({
        query: GET_WORKSPACES,
        fetchPolicy: 'network-only',
      })
      .then((result) => {
        const workspaces = result.data?.workspaces ?? [];
        if (workspaces.length > 0) {
          // El usuario tiene al menos un workspace: ir al primero (el más reciente en BD)
          navigate(`/${workspaces[0].slug}`, { replace: true });
        } else {
          // Usuario nuevo sin workspaces: llevarlo al flujo de onboarding
          navigate(ROUTES.ONBOARDING, { replace: true });
        }
      })
      .catch(() => {
        // Si la query falla (red, permisos), redirigir al onboarding como fallback seguro
        // en lugar de dejar al usuario atascado en el spinner
        navigate(ROUTES.ONBOARDING, { replace: true });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // El array vacío es intencional: este efecto debe ejecutarse exactamente una vez al montar.
  // `params` es estable durante el ciclo de vida de esta página (los query params no cambian).

  // La UI es intencionalmente minimalista: el usuario no necesita interactuar,
  // solo esperar la fracción de segundo que tarda el procesamiento
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Spinner size="lg" />
    </div>
  );
}
