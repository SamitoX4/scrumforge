/**
 * env.validation.ts — Validación de variables de entorno al arranque.
 *
 * Este módulo implementa el principio de "fail fast": si el servidor no tiene
 * la configuración mínima necesaria para funcionar, termina el proceso
 * inmediatamente con un mensaje claro en lugar de fallar de forma inesperada
 * más adelante durante la ejecución.
 *
 * Estrategia:
 *  - Variables REQUERIDAS: si alguna falta, se aborta el proceso con `exit(1)`.
 *  - Variables OPCIONALES con defecto: se asigna el valor por defecto y se
 *    emite una advertencia para que el operador sea consciente.
 *  - Variables de SERVICIOS opcionales: se loguea cuáles están activos y cuáles
 *    no, para facilitar el diagnóstico en producción.
 */

import { logger } from '../utils/logger';

/** Variables de entorno requeridas para que el servidor arranque */
const REQUIRED_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
] as const;

/** Variables con valor por defecto si no están definidas */
const OPTIONAL_DEFAULTS: Record<string, string> = {
  NODE_ENV: 'development',
  PORT: '4000',
  FRONTEND_URL: 'http://localhost:5173',
  JWT_EXPIRES_IN: '7d',
  JWT_REFRESH_EXPIRES_IN: '30d',
};

/**
 * Variables de entorno para servicios opcionales.
 * Estas variables NO son necesarias para arrancar el servidor, pero habilitan
 * funcionalidades específicas. Si faltan, la funcionalidad correspondiente
 * queda deshabilitada sin error fatal.
 *
 * - ANTHROPIC_API_KEY       — Funcionalidades de IA (sugerencias de código, resúmenes)
 * - GITHUB_TOKEN            — Integración con GitHub (vincular repos, PRs)
 * - STRIPE_SECRET_KEY       — Facturación con Stripe
 * - STRIPE_WEBHOOK_SECRET   — Verificación de firma en webhooks de Stripe
 * - STRIPE_PRICE_PRO        — ID de precio de Stripe para el plan Pro
 * - STRIPE_PRICE_BUSINESS   — ID de precio de Stripe para el plan Business
 * - SLACK_WEBHOOK_URL       — Integración de notificaciones con Slack
 * - GOOGLE_CLIENT_ID        — Login con Google OAuth
 * - GOOGLE_CLIENT_SECRET    — Login con Google OAuth
 * - RESEND_API_KEY          — Email transaccional vía Resend (preferido)
 * - MAIL_SERVICE            — Email transaccional vía Nodemailer (alternativa)
 * - MAIL_USER               — Usuario SMTP de Nodemailer
 * - MAIL_PASS               — Contraseña SMTP de Nodemailer
 */
const OPTIONAL_SERVICE_VARS: Record<string, string> = {
  ANTHROPIC_API_KEY: 'AI features',
  GITHUB_TOKEN: 'GitHub integration',
  STRIPE_SECRET_KEY: 'Stripe billing',
  STRIPE_WEBHOOK_SECRET: 'Stripe webhook verification',
  STRIPE_PRICE_PRO: 'Stripe Pro plan price',
  STRIPE_PRICE_BUSINESS: 'Stripe Business plan price',
  SLACK_WEBHOOK_URL: 'Slack notifications',
  GOOGLE_CLIENT_ID: 'Google OAuth',
  GOOGLE_CLIENT_SECRET: 'Google OAuth',
  RESEND_API_KEY: 'Resend email service',
  MAIL_SERVICE: 'Nodemailer email service',
  MAIL_USER: 'Nodemailer SMTP user',
  MAIL_PASS: 'Nodemailer SMTP password',
};

/**
 * Valida las variables de entorno al arrancar el servidor.
 *
 * Ejecuta tres fases en orden:
 *  1. Verifica que todas las variables REQUERIDAS estén presentes. Si alguna
 *     falta, registra el error y termina el proceso con código 1.
 *  2. Advierte si JWT_SECRET es demasiado corto (< 32 caracteres), ya que
 *     un secreto débil facilita la falsificación de tokens.
 *  3. Aplica valores por defecto a las variables OPCIONALES no definidas.
 *  4. Loguea el estado de cada servicio opcional (configurado / no configurado).
 */
export function validateEnv(): void {
  const missing: string[] = [];

  // Fase 1: comprobar variables obligatorias
  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  // Si hay alguna variable requerida ausente, terminar el proceso inmediatamente
  if (missing.length > 0) {
    logger.error(
      `Variables de entorno requeridas no definidas: ${missing.join(', ')}. ` +
        'Copia .env.example a .env y configura los valores necesarios.',
    );
    process.exit(1);
  }

  // Fase 2: advertir sobre JWT_SECRET débil antes de continuar con el arranque
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    logger.warn('JWT_SECRET debería tener al menos 32 caracteres para mayor seguridad');
  }

  // Fase 3: aplicar valores por defecto a variables opcionales no definidas
  for (const [key, defaultValue] of Object.entries(OPTIONAL_DEFAULTS)) {
    if (!process.env[key]) {
      process.env[key] = defaultValue;
      logger.warn(`${key} no definida — usando valor por defecto: "${defaultValue}"`);
    }
  }

  // Fase 4: registrar qué servicios opcionales están activos y cuáles no
  const configured: string[] = [];
  const notConfigured: string[] = [];
  for (const [key, description] of Object.entries(OPTIONAL_SERVICE_VARS)) {
    if (process.env[key]) {
      configured.push(`${key} (${description})`);
    } else {
      notConfigured.push(`${key} (${description})`);
    }
  }

  if (configured.length > 0) {
    logger.info({ services: configured }, 'Optional services configured');
  }
  if (notConfigured.length > 0) {
    // Se loguea en debug porque tener servicios desactivados es normal
    logger.debug({ services: notConfigured }, 'Optional services not configured (disabled)');
  }

  // Fase 5: validar HTTPS_MODE y las rutas de certificado TLS si aplica
  const httpsMode = process.env.HTTPS_MODE ?? 'off';
  const validHttpsModes = ['off', 'proxy', 'standalone'] as const;

  if (!validHttpsModes.includes(httpsMode as typeof validHttpsModes[number])) {
    logger.error(
      `HTTPS_MODE="${httpsMode}" no es válido. Valores permitidos: off | proxy | standalone`,
    );
    process.exit(1);
  }

  if (httpsMode === 'standalone') {
    // En modo standalone el backend levanta TLS directamente: los archivos de
    // certificado son obligatorios. Si faltan, abortamos con un error claro.
    const missingTls: string[] = [];
    if (!process.env.TLS_CERT_PATH) missingTls.push('TLS_CERT_PATH');
    if (!process.env.TLS_KEY_PATH)  missingTls.push('TLS_KEY_PATH');

    if (missingTls.length > 0) {
      logger.error(
        `HTTPS_MODE=standalone requiere: ${missingTls.join(', ')}. ` +
        'Consulta la sección HTTPS en .env.example.',
      );
      process.exit(1);
    }

    logger.info(
      { certPath: process.env.TLS_CERT_PATH, keyPath: process.env.TLS_KEY_PATH },
      'HTTPS standalone: certificado TLS configurado',
    );
  }

  if (httpsMode === 'proxy') {
    logger.info('HTTPS proxy: redirección HTTP → HTTPS activa (X-Forwarded-Proto)');
  }

  logger.info('Variables de entorno validadas correctamente');
}
