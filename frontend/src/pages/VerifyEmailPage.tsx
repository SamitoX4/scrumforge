/**
 * @file VerifyEmailPage.tsx
 * @description Página de verificación de email. Cubre dos casos de uso distintos
 * según la presencia o ausencia del parámetro `?token=...` en la URL:
 *
 * **Caso A — Con token (enlace desde el email):**
 * El usuario hizo clic en el enlace de verificación enviado por correo.
 * Se ejecuta automáticamente la mutación `VERIFY_EMAIL` al montar el componente.
 * Si tiene éxito: se limpia el auth store (para forzar re-login con `emailVerified: true`)
 * y se muestra confirmación. Si falla: se muestra el error.
 *
 * **Caso B — Sin token (llegó tras registrarse):**
 * El usuario acaba de registrarse y se le redirigió aquí para que sepa que debe
 * verificar su email. Se muestra un botón para reenviar el correo de verificación.
 *
 * La limpieza del auth store al verificar es necesaria porque el JWT emitido
 * durante el registro tiene `emailVerified: false`. Tras verificar, el usuario
 * debe obtener un JWT nuevo (iniciando sesión de nuevo) que refleje el cambio.
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client/react';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { Button } from '@/components/atoms/Button/Button';
import { ROUTES } from '@/constants/routes';
import { VERIFY_EMAIL, SEND_VERIFICATION_EMAIL } from '@/graphql/mutations/auth-extended.mutations';
import { useAuthStore } from '@/store/auth.store';
import { apolloClient } from '@/graphql/client';

/**
 * Página de verificación de email con soporte para verificación automática
 * (vía token en URL) y reenvío manual del correo de verificación.
 *
 * @returns JSX con el layout de autenticación y el estado de verificación correspondiente.
 */
export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();

  // El token puede ser null si el usuario llegó aquí tras el registro
  // (sin haber hecho clic en el email de verificación aún)
  const token = searchParams.get('token');
  const { clearAuth } = useAuthStore();
  const navigate = useNavigate();

  /**
   * Limpia el estado de autenticación en memoria y el caché de Apollo antes
   * de redirigir al login. Esto es necesario porque:
   * 1. El JWT almacenado tiene `emailVerified: false` y ya no es válido.
   * 2. El caché de Apollo puede contener datos de un usuario no verificado.
   * Ambos se deben limpiar para evitar inconsistencias en la próxima sesión.
   */
  function handleGoToLogin() {
    clearAuth();
    apolloClient.clearStore().catch(() => {});
    navigate(ROUTES.LOGIN);
  }

  /** Email verificado exitosamente en esta sesión. */
  const [verified, setVerified] = useState(false);

  /**
   * El email ya estaba verificado antes de esta visita.
   * Se detecta cuando el backend devuelve un error con el mensaje "ya ha sido verificado".
   * Se trata como estado de éxito desde la perspectiva del UX (el objetivo está cumplido).
   */
  const [alreadyVerified, setAlreadyVerified] = useState(false);

  /** Mensaje de error del servidor que no corresponde a "ya verificado". */
  const [error, setError] = useState('');

  /** Indica si el correo de verificación fue reenviado con éxito en esta sesión. */
  const [resent, setResent] = useState(false);

  const [verifyEmail, { loading: verifying }] = useMutation<{ verifyEmail: boolean }>(VERIFY_EMAIL, {
    onCompleted: () => {
      // Limpiar el auth store para que el usuario inicie sesión de nuevo
      // y obtenga un JWT con emailVerified: true desde el backend
      clearAuth();
      apolloClient.clearStore().catch(() => {});
      setVerified(true);
    },
    onError: (err) => setError(err.message),
  });

  const [sendVerificationEmail, { loading: sending }] = useMutation<{ sendVerificationEmail: boolean }>(
    SEND_VERIFICATION_EMAIL,
    {
      onCompleted: () => setResent(true),
      onError: (err) => {
        // Diferenciar entre el error "ya verificado" (que es bueno) y otros errores reales.
        // El mensaje puede venir en español o inglés según la configuración del servidor.
        if (err.message.toLowerCase().includes('ya ha sido verificado') || err.message.toLowerCase().includes('already verified')) {
          setAlreadyVerified(true);
        } else {
          setError(err.message);
        }
      },
    },
  );

  /**
   * Dispara la verificación automáticamente cuando el token está presente en la URL.
   * Se ejecuta una sola vez al montar (o si el token cambia, aunque en la práctica
   * el token es estático durante el ciclo de vida de la página).
   *
   * Se deshabilita la regla de exhaustividad de deps porque incluir `verifyEmail`
   * causaría una re-ejecución innecesaria (la función es estable pero Apollo la regenera).
   */
  useEffect(() => {
    if (token) {
      verifyEmail({ variables: { token } });
    }
  // Solo ejecutar cuando el token cambia
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          {/* El título cambia dinámicamente según si ya se completó la verificación */}
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            {verified ? 'Email verificado' : 'Verifica tu email'}
          </h1>

          {/* Caso B: usuario recién registrado esperando verificar, sin token todavía */}
          {!token && !verified && (
            <p style={{ color: '#6B7280' }}>
              Te hemos enviado un correo de verificación. Revisa tu bandeja de entrada y
              haz clic en el enlace para activar tu cuenta.
            </p>
          )}

          {/* Caso A en curso: token presente y mutación ejecutándose */}
          {token && verifying && <p style={{ color: '#6B7280' }}>Verificando...</p>}

          {/* Resultado exitoso: verificación recién completada o ya estaba verificado */}
          {(verified || alreadyVerified) && (
            <p style={{ color: '#059669' }}>
              Tu correo electrónico ya está verificado. Ya puedes iniciar sesión.
            </p>
          )}

          {/* Error real del servidor (distinto a "ya verificado") */}
          {error && (
            <p style={{ color: '#DC2626', background: '#FEF2F2', padding: '12px 16px', borderRadius: '6px', border: '1px solid #FECACA' }}>
              {error}
            </p>
          )}

          {/* Confirmación de reenvío exitoso */}
          {resent && (
            <p style={{ color: '#059669' }}>
              Correo de verificación reenviado. Revisa tu bandeja de entrada.
            </p>
          )}
        </div>

        {/* Acción principal: ir al login si ya está verificado, o reenviar email si no */}
        {(verified || alreadyVerified) ? (
          <Button fullWidth onClick={handleGoToLogin}>Iniciar sesión</Button>
        ) : (
          // Solo mostrar el botón de reenvío cuando NO hay token en la URL;
          // si hay token significa que el usuario ya vino del enlace del email,
          // y mostrar "reenviar" aquí sería confuso
          !token && (
            <Button
              fullWidth
              loading={sending}
              onClick={() => sendVerificationEmail()}
              // Deshabilitar tras reenviar para evitar spam de emails
              disabled={resent}
            >
              {resent ? 'Email reenviado' : 'Reenviar email de verificación'}
            </Button>
          )
        )}

        {/* Escape: permite volver al login limpiando el estado de auth */}
        <p style={{ textAlign: 'center', fontSize: '14px', color: '#6B7280' }}>
          <button
            onClick={handleGoToLogin}
            style={{ background: 'none', border: 'none', color: '#3B82F6', fontWeight: 500, cursor: 'pointer', fontSize: '14px', padding: 0 }}
          >
            Volver al inicio de sesión
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
