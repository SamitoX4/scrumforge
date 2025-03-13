/**
 * @file logger.ts
 * @module utils
 * @description Logger centralizado de la aplicación basado en Pino.
 *
 * Pino es un logger de alto rendimiento para Node.js que serializa los mensajes
 * en formato JSON (producción) o texto con colores (desarrollo).
 *
 * Configuración:
 * - **Nivel**: controlado por la variable de entorno `LOG_LEVEL` (por defecto `info`).
 *   Niveles disponibles: trace, debug, info, warn, error, fatal.
 * - **Redact**: lista de rutas de campos que se censuran automáticamente antes de
 *   escribir el log. Si un resolver o middleware registra accidentalmente el contexto
 *   de una petición que incluye la cabecera `authorization`, una contraseña o un token,
 *   Pino reemplaza el valor por `[REDACTED]` en lugar de escribirlo en texto plano.
 *   La lista cubre tanto claves de primer nivel como rutas anidadas comunes (p. ej.
 *   `req.headers.authorization`, `body.password`).
 * - **Transporte en desarrollo**: se usa `pino-pretty` cuando `NODE_ENV` no es `production`
 *   para renderizar logs con colores y formato legible en la terminal.
 * - **Producción**: sin transporte adicional; los logs salen en JSON por stdout,
 *   listo para ser ingerido por herramientas como Datadog, CloudWatch o ELK.
 *
 * @example
 * ```typescript
 * import { logger } from './utils/logger';
 * logger.info('Servidor iniciado en el puerto 4000');
 * logger.error({ err }, 'Error al procesar la petición');
 * // Si "err" tuviese un campo "password", saldría como [REDACTED] en el log
 * ```
 */

import pino from 'pino';

/**
 * Campos sensibles que nunca deben aparecer en texto plano en los logs.
 *
 * La sintaxis de `redact` de Pino acepta:
 * - Claves simples: `'password'` → cualquier campo llamado "password" en el objeto raíz.
 * - Rutas con punto: `'req.headers.authorization'` → campo anidado exacto.
 * - Wildcards: `'*.password'` → campo "password" a cualquier nivel de un objeto hijo.
 *
 * Se cubre tanto el nombre en inglés como en español de cada campo para atrapar
 * los casos más habituales sin necesidad de cambiar el código de los resolvers.
 */
const REDACTED_PATHS = [
  // Cabecera de autenticación HTTP (JWT Bearer token)
  'authorization',
  'req.headers.authorization',

  // Contraseñas en texto plano (registro, cambio de contraseña, etc.)
  'password',
  'newPassword',
  'currentPassword',
  'body.password',
  'body.newPassword',
  '*.password',
  '*.newPassword',

  // Tokens de sesión y refresco
  'token',
  'refreshToken',
  'accessToken',
  '*.token',
  '*.refreshToken',
  '*.accessToken',

  // Claves de API externas (Anthropic, Stripe, etc.)
  'apiKey',
  'stripeSecretKey',
  '*.apiKey',

  // Cookies (pueden contener tokens de sesión)
  'req.headers.cookie',
  'cookie',
];

/**
 * Instancia única del logger compartida en toda la aplicación.
 * Se exporta como singleton para que todos los módulos usen la misma
 * configuración y nivel de log.
 */
export const logger = pino({
  // El nivel se puede ajustar sin recompilar mediante variable de entorno
  level: process.env.LOG_LEVEL ?? 'info',

  // Censurar campos sensibles antes de escribir el log.
  // Pino reemplaza el valor por '[REDACTED]' en el JSON de salida,
  // independientemente de si el log viene de un resolver, middleware o error handler.
  redact: {
    paths: REDACTED_PATHS,
    censor: '[REDACTED]',
  },

  // pino-pretty solo se usa fuera de producción para no penalizar el rendimiento
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});
