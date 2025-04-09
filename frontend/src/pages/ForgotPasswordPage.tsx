/**
 * @file ForgotPasswordPage.tsx
 * @description Página de recuperación de contraseña. Permite a un usuario que ha olvidado
 * su contraseña solicitar un enlace de restablecimiento por email.
 *
 * Flujo:
 * 1. El usuario ingresa su email y envía el formulario.
 * 2. Se dispara la mutación `FORGOT_PASSWORD` contra el backend.
 * 3. Independientemente de si el email existe o no (anti-enumeración), el servidor
 *    responde con éxito y la UI muestra una pantalla de confirmación genérica.
 * 4. Si el email existe, el backend envía un correo con el enlace de restablecimiento.
 *
 * La doble vista (formulario / confirmación) se controla con el estado `submitted`,
 * evitando una navegación a otra ruta y manteniendo el contexto en la misma página.
 */

import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@apollo/client/react';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { FormField } from '@/components/molecules/FormField/FormField';
import { Input } from '@/components/atoms/Input/Input';
import { Button } from '@/components/atoms/Button/Button';
import { ROUTES } from '@/constants/routes';
import { FORGOT_PASSWORD } from '@/graphql/mutations/auth-extended.mutations';

/**
 * Página de recuperación de contraseña olvidada.
 *
 * Gestiona dos estados visuales en el mismo componente:
 * - **Formulario**: pide el email y envía la solicitud al backend.
 * - **Confirmación**: informa al usuario que revise su correo (mensaje genérico
 *   que no revela si el email está registrado o no, protegiendo contra enumeración).
 *
 * @returns JSX con el layout de autenticación y la vista correspondiente al estado actual.
 */
export default function ForgotPasswordPage() {
  /** Email introducido por el usuario en el campo de texto. */
  const [email, setEmail] = useState('');

  /**
   * Controla si se muestra el formulario o la pantalla de confirmación.
   * Se activa en `onCompleted` de la mutación GraphQL, garantizando que el cambio
   * de vista solo ocurre cuando el servidor ha procesado la solicitud correctamente.
   */
  const [submitted, setSubmitted] = useState(false);

  /** Mensaje de error proveniente de la respuesta del servidor. */
  const [error, setError] = useState('');

  const [forgotPassword, { loading }] = useMutation<{ forgotPassword: boolean }>(FORGOT_PASSWORD, {
    onCompleted: () => setSubmitted(true),
    onError: (err) => setError(err.message),
  });

  /**
   * Maneja el envío del formulario de recuperación de contraseña.
   *
   * Previene el comportamiento nativo del formulario, limpia errores previos
   * y guarda al servidor el llamado solo si hay un email introducido
   * (la validación HTML `required` y el chequeo JS son capas complementarias).
   *
   * @param e - Evento de envío del formulario HTML.
   */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    // Guardia mínima: aunque el atributo `required` del Input previene el envío
    // desde el navegador, este check protege ante envíos programáticos
    if (!email) return;
    await forgotPassword({ variables: { email } });
  }

  return (
    <AuthLayout>
      {/* Vista condicional: confirmación post-envío o formulario inicial */}
      {submitted ? (
        // Pantalla de confirmación genérica: el mensaje no confirma ni desmiente
        // que el email esté registrado para evitar ataques de enumeración de usuarios
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
              Revisa tu email
            </h1>
            <p style={{ color: '#6B7280' }}>
              Si existe una cuenta asociada a <strong>{email}</strong>, recibirás un
              enlace para restablecer tu contraseña en los próximos minutos.
            </p>
          </div>
          <p style={{ textAlign: 'center', fontSize: '14px', color: '#6B7280' }}>
            <Link to={ROUTES.LOGIN} style={{ color: '#3B82F6', fontWeight: 500 }}>
              Volver al inicio de sesión
            </Link>
          </p>
        </div>
      ) : (
        // noValidate desactiva la validación nativa del navegador para controlar
        // la experiencia de error de forma consistente con el sistema de diseño
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} noValidate>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
              ¿Olvidaste tu contraseña?
            </h1>
            <p style={{ color: '#6B7280' }}>
              Ingresa tu correo electrónico y te enviaremos un enlace para restablecerla.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* El error se pasa a FormField para mostrarlo debajo del input
                y se limpia al cambiar el valor del campo, dando feedback inmediato */}
            <FormField label="Correo electrónico" htmlFor="email" required error={error}>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="tu@empresa.com"
                autoComplete="email"
                required
              />
            </FormField>
          </div>

          <Button type="submit" fullWidth loading={loading}>
            Enviar enlace de restablecimiento
          </Button>

          <p style={{ textAlign: 'center', fontSize: '14px', color: '#6B7280' }}>
            <Link to={ROUTES.LOGIN} style={{ color: '#3B82F6', fontWeight: 500 }}>
              Volver al inicio de sesión
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
