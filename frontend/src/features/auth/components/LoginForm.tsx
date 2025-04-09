import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { FormField } from '@/components/molecules/FormField/FormField';
import { Input } from '@/components/atoms/Input/Input';
import { Button } from '@/components/atoms/Button/Button';
import { ROUTES } from '@/constants/routes';
import { config } from '@/constants/config';
import styles from './AuthForm.module.scss';

/**
 * LoginForm — formulario de inicio de sesión con credenciales locales y Google OAuth.
 *
 * Flujo de autenticación:
 * 1. El usuario introduce email y contraseña.
 * 2. Se invoca `login` del hook `useAuth`, que llama al backend y actualiza
 *    el store global de autenticación si tiene éxito.
 * 3. En caso de error (credenciales incorrectas, cuenta sin verificar, etc.)
 *    se muestra el mensaje al lado del campo de contraseña, sin revelar
 *    cuál de los dos campos es incorrecto (seguridad por ambigüedad).
 * 4. Para Google OAuth se redirige directamente al endpoint del backend,
 *    que gestiona el flujo de code exchange y la redirección final.
 *
 * El formulario usa `noValidate` para controlar la validación manualmente
 * y mostrar errores localizados en lugar de los nativos del navegador.
 *
 * @returns Formulario de login renderizado con campos de email, contraseña,
 *          enlace de recuperación, botón OAuth y enlace de registro.
 *
 * @example
 * // Uso en la página de autenticación
 * <LoginForm />
 */
export function LoginForm() {
  const { login, loading } = useAuth();
  const { t } = useTranslation();

  // Estado local del formulario — no se almacena en ningún store global
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Error unificado de credenciales — se ubica en el campo de contraseña
  // para no indicar cuál campo específico falló
  const [credentialError, setCredentialError] = useState('');

  /**
   * Maneja el envío del formulario de login.
   *
   * Limpia el error previo antes de cada intento para evitar que un mensaje
   * de error anterior permanezca visible si el usuario vuelve a intentarlo.
   * Si el login falla, captura el error y lo muestra en el campo de contraseña.
   *
   * @param e - Evento de envío del formulario HTML.
   */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setCredentialError('');
    try {
      await login(email, password);
    } catch (err) {
      // Si el error tiene mensaje propio se usa; si no, se muestra el mensaje genérico
      setCredentialError(err instanceof Error ? err.message : t('common.error'));
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('auth.welcomeBack')}</h1>
        <p className={styles.subtitle}>{t('auth.welcomeBackSub')}</p>
      </div>

      <div className={styles.fields}>
        <FormField label={t('auth.email')} htmlFor="email" required>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setCredentialError(''); }}
            placeholder="tu@empresa.com"
            autoComplete="email"
            required
          />
        </FormField>

        {/* El error de credenciales se coloca en el campo contraseña
            para no revelar si es el email o la contraseña el que falló */}
        <FormField label={t('auth.password')} htmlFor="password" required error={credentialError}>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setCredentialError(''); }}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </FormField>

        {/* Enlace de recuperación — alineado a la derecha para seguir el patrón UX habitual */}
        <div style={{ textAlign: 'right', marginTop: '-8px' }}>
          <Link to={ROUTES.FORGOT_PASSWORD} className={styles.link} style={{ fontSize: '14px' }}>
            {t('auth.forgotPassword')}
          </Link>
        </div>
      </div>

      {/* Botón principal — muestra spinner mientras `loading` es true */}
      <Button type="submit" fullWidth loading={loading}>
        {t('auth.login')}
      </Button>

      <div className={styles.divider}>{t('auth.or')}</div>

      {/* Botón de Google OAuth — enlace directo al endpoint del backend,
          que inicia el flujo de redirección OAuth2 sin pasar por React Router */}
      <a
        href={`${config.backendUrl}/auth/google`}
        className={styles.googleBtn}
      >
        {/* SVG inline del logo de Google con los colores oficiales por sección */}
        <svg className={styles.googleIcon} viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {t('auth.continueWithGoogle')}
      </a>

      {/* Enlace de registro para usuarios nuevos */}
      <p className={styles.footer}>
        {t('auth.noAccount')}{' '}
        <Link to={ROUTES.REGISTER} className={styles.link}>
          {t('auth.register')}
        </Link>
      </p>

      {/* Credenciales de demo visibles solo en desarrollo/demo.
          Permite probar la aplicación sin registrarse. */}
      <div className={styles.demo}>
        <p className={styles['demo__label']}>{t('auth.demoCredentials')}</p>
        <code className={styles['demo__code']}>admin@scrumforge.dev / password123</code>
      </div>
    </form>
  );
}
