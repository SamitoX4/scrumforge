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
 * Evalúa en tiempo real qué requisitos de contraseña cumple el valor introducido.
 * Se usa para mostrar la lista de checks verde/rojo mientras el usuario escribe,
 * igual que lo hacen GitHub, Notion o Linear.
 *
 * @param password - Valor actual del campo de contraseña.
 * @returns Objeto con un booleano por cada requisito.
 */
function checkRequirements(password: string) {
  return {
    length:    password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number:    /[0-9]/.test(password),
  };
}

/**
 * RegisterForm — formulario de creación de cuenta nueva.
 *
 * Funcionalidades:
 * - Campos de nombre completo, email y contraseña.
 * - Lista de requisitos de contraseña en tiempo real (longitud, mayúscula, minúscula, número).
 * - Validación completa de la política de contraseña en cliente antes de llamar al servidor.
 * - Clasificación inteligente del error del servidor: si el mensaje menciona
 *   "email" o "correo" se muestra junto al campo de email; en cualquier otro
 *   caso se muestra junto al campo de contraseña.
 * - Estado `registered` que reemplaza el formulario completo por una pantalla
 *   de confirmación, indicando al usuario que debe verificar su correo antes
 *   de poder iniciar sesión.
 *
 * El mismo endpoint de Google OAuth del backend sirve tanto para registro
 * como para login; el backend crea la cuenta automáticamente si no existe.
 *
 * @returns Formulario de registro o pantalla de confirmación de email,
 *          dependiendo del estado `registered`.
 *
 * @example
 * // Uso en la página de registro
 * <RegisterForm />
 */
export function RegisterForm() {
  const { register, loading } = useAuth();
  const { t } = useTranslation();

  // Campos del formulario
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Errores por campo — separados para ubicarlos junto al input correcto
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Estado post-registro: muestra pantalla de verificación de email
  const [registered, setRegistered] = useState(false);
  // Se guarda el email para mostrarlo en la confirmación sin que el usuario
  // tenga que recordarlo
  const [registeredEmail, setRegisteredEmail] = useState('');

  // Requisitos evaluados en tiempo real conforme el usuario escribe la contraseña
  const reqs = checkRequirements(password);
  // El checklist solo se muestra cuando el campo tiene contenido para no confundir
  // al usuario antes de que empiece a escribir
  const showChecklist = password.length > 0;

  /**
   * Maneja el envío del formulario de registro.
   *
   * Valida la longitud de la contraseña en cliente para evitar una llamada
   * innecesaria al servidor cuando la contraseña es claramente demasiado corta.
   * Si el servidor responde con error, clasifica el mensaje para mostrarlo
   * en el campo correspondiente (email o contraseña).
   *
   * @param e - Evento de envío del formulario HTML.
   */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEmailError('');
    setPasswordError('');

    // Validación client-side: todos los requisitos de la política de contraseña
    const r = checkRequirements(password);
    if (!r.length || !r.uppercase || !r.lowercase || !r.number) {
      setPasswordError(t('auth.passwordMin'));
      return;
    }
    try {
      await register(name, email, password);
      // Tras registro exitoso, guardamos el email y mostramos pantalla de verificación
      setRegisteredEmail(email);
      setRegistered(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al registrarse';
      // Si el error menciona el email, se muestra en ese campo; si no, en contraseña
      if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('correo')) {
        setEmailError(msg);
      } else {
        setEmailError('');
        setPasswordError(msg);
      }
    }
  }

  // Pantalla de confirmación que se muestra en lugar del formulario
  // una vez que el registro fue exitoso
  if (registered) {
    return (
      <div className={styles.form}>
        <div className={styles.header}>
          <h1 className={styles.title}>{t('auth.checkEmail')}</h1>
          <p className={styles.subtitle}>
            {t('auth.verificationSent')}{' '}
            {/* Se muestra el email registrado para que el usuario sepa dónde buscar */}
            <strong>{registeredEmail}</strong>. {t('auth.verificationHint')}
          </p>
        </div>
        <p className={styles.footer}>
          {t('auth.alreadyVerified')}{' '}
          <Link to={ROUTES.LOGIN} className={styles.link}>
            {t('auth.login')}
          </Link>
        </p>
        <p className={styles.footer}>
          {/* Enlace para reenviar el correo de verificación si no llegó */}
          <Link to={ROUTES.VERIFY_EMAIL} className={styles.link}>
            {t('auth.resendVerification')}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('auth.createAccount')}</h1>
        <p className={styles.subtitle}>{t('auth.createAccountSub')}</p>
      </div>

      <div className={styles.fields}>
        <FormField label={t('auth.fullName')} htmlFor="name" required>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            autoComplete="name"
            required
          />
        </FormField>

        {/* El error de email se limpia al editar para no confundir al usuario */}
        <FormField label={t('auth.email')} htmlFor="email" required error={emailError}>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
            placeholder="tu@empresa.com"
            autoComplete="email"
            required
          />
        </FormField>

        {/* El error se limpia al empezar a escribir; el checklist reemplaza la necesidad del hint */}
        <FormField label={t('auth.password')} htmlFor="password" required error={passwordError}>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPasswordError(''); }}
            placeholder="••••••••"
            // new-password indica al gestor de contraseñas que puede generar una nueva
            autoComplete="new-password"
            required
          />
          {/* Checklist de requisitos en tiempo real — se muestra solo cuando hay contenido */}
          {showChecklist && (
            <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {(
                [
                  ['length',    t('auth.passwordReqLength')],
                  ['uppercase', t('auth.passwordReqUppercase')],
                  ['lowercase', t('auth.passwordReqLowercase')],
                  ['number',    t('auth.passwordReqNumber')],
                ] as [keyof typeof reqs, string][]
              ).map(([key, label]) => (
                <li key={key} style={{ color: reqs[key] ? '#059669' : '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {/* Checkmark verde cuando cumple el requisito, círculo gris cuando no */}
                  <span aria-hidden="true">{reqs[key] ? '✓' : '○'}</span>
                  {label}
                </li>
              ))}
            </ul>
          )}
        </FormField>
      </div>

      <Button type="submit" fullWidth loading={loading}>
        {t('auth.createAccount')}
      </Button>

      <div className={styles.divider}>{t('auth.or')}</div>

      {/* Acceso con Google — el backend gestiona tanto registro como login con OAuth */}
      <a
        href={`${config.backendUrl}/auth/google`}
        className={styles.googleBtn}
      >
        {/* SVG inline del logo de Google con los colores oficiales de la marca */}
        <svg className={styles.googleIcon} viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {t('auth.continueWithGoogle')}
      </a>

      {/* Enlace a login para usuarios que ya tienen cuenta */}
      <p className={styles.footer}>
        {t('auth.alreadyAccount')}{' '}
        <Link to={ROUTES.LOGIN} className={styles.link}>
          {t('auth.login')}
        </Link>
      </p>
    </form>
  );
}
