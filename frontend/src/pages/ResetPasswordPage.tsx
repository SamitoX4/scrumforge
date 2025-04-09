/**
 * @file ResetPasswordPage.tsx
 * @description Página de restablecimiento de contraseña. El usuario llega aquí
 * desde el enlace enviado por email tras solicitar la recuperación de contraseña.
 *
 * Flujo:
 * 1. El token JWT de restablecimiento llega como parámetro `?token=...` en la URL.
 * 2. El usuario introduce y confirma su nueva contraseña.
 * 3. Se realizan validaciones client-side (longitud mínima, coincidencia, token presente).
 * 4. Si las validaciones pasan, se llama a la mutación `RESET_PASSWORD` con el token y la nueva contraseña.
 * 5. Al completarse exitosamente, se muestra una pantalla de éxito y se redirige
 *    automáticamente al login tras 3 segundos (permitiendo también hacerlo manualmente).
 *
 * La redirección con `setTimeout` de 3 segundos da tiempo al usuario de leer la
 * confirmación, pero le permite avanzar de inmediato si lo desea con el botón.
 */

import { useState, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@apollo/client/react';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { FormField } from '@/components/molecules/FormField/FormField';
import { Input } from '@/components/atoms/Input/Input';
import { Button } from '@/components/atoms/Button/Button';
import { ROUTES } from '@/constants/routes';
import { RESET_PASSWORD } from '@/graphql/mutations/auth-extended.mutations';

/**
 * Página para establecer una nueva contraseña usando el token de recuperación.
 *
 * El token se extrae de los query params de la URL en lugar del estado del router,
 * ya que el usuario llega directamente desde un enlace de email (no desde navegación
 * interna), por lo que el estado de React no estaría disponible.
 *
 * @returns JSX con el formulario de nueva contraseña o la pantalla de éxito post-reset.
 */
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();

  // Extraer el token del query param; si no existe, la validación posterior lo capturará
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  /** Mensaje de error: puede provenir de validaciones client-side o del servidor. */
  const [error, setError] = useState('');
  /** Controla si se muestra la pantalla de éxito o el formulario. */
  const [success, setSuccess] = useState(false);

  const [resetPassword, { loading }] = useMutation<{ resetPassword: boolean }>(RESET_PASSWORD, {
    onCompleted: () => {
      setSuccess(true);
      // Redirigir automáticamente después de 3 segundos para que el usuario
      // pueda leer el mensaje de confirmación antes de ser llevado al login
      setTimeout(() => navigate(ROUTES.LOGIN), 3000);
    },
    onError: (err) => setError(err.message),
  });

  /**
   * Maneja el envío del formulario de restablecimiento de contraseña.
   *
   * Realiza tres validaciones en orden antes de llamar al servidor:
   * 1. Longitud mínima de 8 caracteres (requisito de seguridad básico).
   * 2. Coincidencia entre los dos campos de contraseña.
   * 3. Presencia del token en la URL (el enlace podría haber sido manipulado).
   *
   * Todas las validaciones se muestran en el campo `confirmPassword` mediante `error`
   * para centralizar el feedback visual sin añadir múltiples zonas de error.
   *
   * @param e - Evento de envío del formulario HTML.
   */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    // Validar política de contraseña: longitud, mayúscula, minúscula y número
    if (
      newPassword.length < 8 ||
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      setError('La contraseña debe tener mínimo 8 caracteres, una mayúscula, una minúscula y un número');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    // Verificar que el token existe en la URL antes de hacer la llamada al servidor;
    // si el usuario accede a esta ruta sin token, informar de inmediato en lugar
    // de dejar que el servidor devuelva un error críptico
    if (!token) {
      setError('Token de restablecimiento no encontrado en la URL');
      return;
    }

    await resetPassword({ variables: { token, newPassword } });
  }

  // Pantalla de éxito: se muestra en lugar del formulario tras el reset exitoso
  if (success) {
    return (
      <AuthLayout>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
              Contraseña restablecida
            </h1>
            {/* Color verde semántico para reforzar visualmente el estado de éxito */}
            <p style={{ color: '#059669' }}>
              Tu contraseña ha sido actualizada exitosamente. Serás redirigido al inicio de sesión en unos segundos.
            </p>
          </div>
          {/* Botón manual para usuarios que no quieren esperar los 3 segundos */}
          <Link to={ROUTES.LOGIN}>
            <Button fullWidth>Iniciar sesión</Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      {/* noValidate: la validación la manejamos manualmente en handleSubmit */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} noValidate>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            Restablecer contraseña
          </h1>
          <p style={{ color: '#6B7280' }}>Ingresa tu nueva contraseña.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* El hint anticipa los requisitos antes de que el usuario cometa el error */}
          <FormField label="Nueva contraseña" htmlFor="newPassword" required hint="Mín. 8 caracteres · mayúscula · minúscula · número">
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </FormField>

          {/* El error de validación (longitud, coincidencia o token) se muestra
              bajo el campo de confirmación porque es el último que el usuario completa */}
          <FormField label="Confirmar contraseña" htmlFor="confirmPassword" required error={error}>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </FormField>
        </div>

        <Button type="submit" fullWidth loading={loading}>
          Restablecer contraseña
        </Button>

        <p style={{ textAlign: 'center', fontSize: '14px', color: '#6B7280' }}>
          <Link to={ROUTES.LOGIN} style={{ color: '#3B82F6', fontWeight: 500 }}>
            Volver al inicio de sesión
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
