/**
 * redis.config.ts — Fábrica de conexión Redis con carga diferida.
 *
 * Diseño:
 *  - La conexión se establece de forma perezosa (lazy): solo cuando algún módulo
 *    solicita el cliente por primera vez mediante `getRedisClient()`.
 *  - El paquete `redis` se carga con `require()` dinámico para que el servidor
 *    arranque sin errores incluso si el paquete no está instalado.
 *  - Si REDIS_URL no está definida o la conexión falla, la función devuelve
 *    `null` y el código llamante debe degradar graciosamente (sin caché).
 *
 * Instalación cuando se necesite:
 *   npm install redis
 */

import { logger } from '../utils/logger';

// Se usa `any` porque el tipo exacto del cliente Redis depende de la versión
// instalada del paquete, que puede no estar presente en el entorno.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisClient = any;

/** Referencia singleton al cliente Redis activo, o null si no hay conexión. */
let _client: RedisClient | null = null;

/**
 * Devuelve un cliente Redis conectado de forma diferida, o `null` si Redis
 * no está configurado o no se puede conectar.
 *
 * El resultado se cachea en `_client` para que las llamadas sucesivas
 * reutilicen la misma conexión sin abrir nuevas al pool de Redis.
 *
 * El código que use este cliente DEBE manejar el caso `null` degradando
 * la funcionalidad (p.ej. omitir el caché, leer siempre de la DB).
 *
 * @returns Cliente Redis conectado, o `null` en modo degradado.
 */
export async function getRedisClient(): Promise<RedisClient | null> {
  // Reutilizar conexión existente si ya está establecida
  if (_client) return _client;

  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn('REDIS_URL no definida — Redis desactivado (modo degradado sin caché)');
    return null;
  }

  try {
    // Carga dinámica con require para evitar error de arranque si el paquete
    // `redis` no está instalado. Este patrón permite que Redis sea opcional.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('redis');
    const client = createClient({ url }) as RedisClient;

    // Registrar handler de errores ANTES de conectar para evitar excepciones
    // no capturadas si Redis se desconecta después del arranque.
    client.on('error', (err: Error) => logger.error({ err }, 'Redis client error'));

    await (client.connect as () => Promise<void>)();
    _client = client;
    logger.info(`Redis conectado: ${url}`);
    return _client;
  } catch {
    // Fallo de conexión no es fatal — el servidor continúa sin caché
    logger.error('No se pudo conectar a Redis — continuando sin caché');
    return null;
  }
}

/**
 * Cierra la conexión Redis de forma ordenada.
 * Se llama durante el graceful shutdown del servidor para liberar el recurso.
 * Si no hay conexión activa, esta función no hace nada.
 */
export async function closeRedis(): Promise<void> {
  if (_client) {
    // `quit` envía el comando QUIT a Redis y espera a que se confirme antes
    // de cerrar el socket, lo que garantiza que los comandos pendientes terminen.
    await _client.quit?.();
    _client = null;
    logger.info('Redis desconectado');
  }
}
