import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { Button } from '@/components/atoms/Button/Button';
import { ROUTES } from '@/constants/routes';
import { useAuthStore } from '@/store/auth.store';

/**
 * AcceptInvitationPage
 *
 * Página pública que permite a un usuario aceptar o rechazar una invitación
 * a un workspace de ScrumForge.
 *
 * Flujo:
 * 1. El backend genera un enlace con el parámetro `?token=<jwt>`.
 * 2. Esta página lee el token de los query params.
 * 3. Si no hay token, se muestra el estado de "invitación inválida".
 * 4. Si el usuario acepta, se llama a `handleAccept` (TODO: mutación GraphQL pendiente)
 *    y, tras 2 segundos, se redirige al workspace activo o al onboarding.
 * 5. Si el usuario rechaza, se muestra el estado de "invitación rechazada".
 *
 * @remarks
 * Las mutaciones `acceptInvitation` / `declineInvitation` aún no están
 * conectadas. Cuando el módulo de invitaciones exponga las operaciones
 * GraphQL correspondientes, se deben enlazar en `handleAccept` y `handleDecline`.
 */
export default function AcceptInvitationPage() {
  // Leer el token de invitación del query string de la URL
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();

  // Slug del workspace activo del usuario autenticado (puede ser null si aún no tiene workspace)
  const { currentWorkspaceSlug } = useAuthStore();
  // Estados mutuamente excluyentes que controlan qué vista se renderiza
  const [accepted, setAccepted] = useState(false);
  const [declined, setDeclined] = useState(false);

  /**
   * Maneja la aceptación de la invitación.
   * Marca el estado como aceptado y redirige al workspace del usuario
   * (o al onboarding si no tiene uno asignado) tras un retardo de 2 segundos.
   *
   * TODO: conectar con la mutación `acceptInvitation` una vez disponible.
   */
  function handleAccept() {
    // TODO: wire to acceptInvitation mutation once available
    setAccepted(true);
    const slug = currentWorkspaceSlug ?? null;
    // Retardo de 2 s para que el usuario pueda leer el mensaje de confirmación
    setTimeout(() => navigate(slug ? `/${slug}` : ROUTES.ONBOARDING), 2000);
  }

  /**
   * Maneja el rechazo de la invitación.
   * Solo actualiza el estado local; no realiza ninguna llamada al backend por ahora.
   *
   * TODO: conectar con la mutación `declineInvitation` una vez disponible.
   */
  function handleDecline() {
    setDeclined(true);
  }

  if (!token) {
    return (
      <AuthLayout>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Invitación inválida</h1>
          <p style={{ color: '#6B7280' }}>
            El enlace de invitación no es válido o ha expirado.
          </p>
          <Link to={ROUTES.LOGIN}>
            <Button fullWidth>Ir al inicio de sesión</Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (accepted) {
    return (
      <AuthLayout>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Invitación aceptada</h1>
          <p style={{ color: '#059669' }}>
            Te has unido al workspace exitosamente. Redirigiendo...
          </p>
        </div>
      </AuthLayout>
    );
  }

  if (declined) {
    return (
      <AuthLayout>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Invitación rechazada</h1>
          <p style={{ color: '#6B7280' }}>Has rechazado la invitación.</p>
          <Link to={ROUTES.LOGIN}>
            <Button fullWidth variant="secondary">Ir al inicio de sesión</Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            Invitación a workspace
          </h1>
          <p style={{ color: '#6B7280' }}>
            Has sido invitado a unirte a un workspace en ScrumForge. ¿Deseas aceptar la invitación?
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Button fullWidth onClick={handleAccept}>
            Aceptar invitación
          </Button>
          <Button fullWidth variant="secondary" onClick={handleDecline}>
            Rechazar
          </Button>
        </div>

        <p style={{ textAlign: 'center', fontSize: '14px', color: '#6B7280' }}>
          <Link to={ROUTES.LOGIN} style={{ color: '#3B82F6', fontWeight: 500 }}>
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
