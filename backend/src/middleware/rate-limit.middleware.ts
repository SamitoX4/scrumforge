/**
 * @file rate-limit.middleware.ts
 * @description Rate limiting con soporte dual: Redis (multi-instancia) o Map en memoria (single-instancia).
 *
 * Estrategia de store:
 *  - Si `REDIS_URL` está definida y Redis responde, se usa Redis como store compartido.
 *    Esto permite que múltiples instancias del servidor (Docker Swarm, Kubernetes, PM2 cluster)
 *    compartan los mismos contadores — un atacante no puede eludir el límite distribuyendo
 *    sus peticiones entre instancias.
 *  - Si Redis no está disponible (no configurado o caído), se degrada automáticamente al
 *    store en memoria (Map). El servidor sigue funcionando; solo pierde la coordinación
 *    entre instancias. Esta degradación es silenciosa para el usuario final.
 *
 * Algoritmo con Redis — ventana fija atómica:
 *  - `INCR key` incrementa el contador y crea la clave si no existe (atómico en Redis).
 *  - `EXPIRE key windowSec` establece el TTL solo en la primera petición de la ventana,
 *    de forma que la clave expira sola al final de la ventana sin necesidad de limpieza manual.
 *  - Toda la operación se ejecuta en un pipeline para minimizar round-trips a Redis.
 *
 * Algoritmo en memoria — ventana fija con Map:
 *  - Cada instancia de `createRateLimit` mantiene su propio Map privado.
 *  - Una limpieza periódica (cada 60 s) elimina entradas expiradas para evitar memory leaks.
 */

import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis.config';
import { logger } from '../utils/logger';

/** Opciones de configuración para un rate limiter. */
interface RateLimitOptions {
  /** Duración de la ventana de tiempo en milisegundos. */
  windowMs: number;
  /** Número máximo de peticiones permitidas por ventana y por IP. */
  max: number;
  /** Prefijo de la clave Redis para distinguir limiters (ej. 'rl:auth', 'rl:api'). */
  keyPrefix?: string;
  /** Mensaje de error incluido en la respuesta 429. */
  message?: string;
}

/** Entrada en el store en memoria para una IP y ruta específicas. */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Fábrica de middleware de rate limiting con store dual (Redis / Map en memoria).
 *
 * En el primer uso intenta obtener el cliente Redis. Si está disponible, todas
 * las peticiones posteriores usan Redis. Si no, usa el Map en memoria como fallback.
 * La decisión se toma una sola vez por instancia del limiter (no en cada petición).
 *
 * Las cabeceras `X-RateLimit-Limit`, `X-RateLimit-Remaining` y `Retry-After`
 * se incluyen en cada respuesta para que el cliente pueda adaptar su cadencia.
 *
 * @param options - Configuración del limiter.
 * @returns Middleware de Express asíncrono que aplica el rate limiting.
 */
export function createRateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    keyPrefix = 'rl',
    message = 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
  } = options;

  const windowSec = Math.ceil(windowMs / 1000);

  // ── Fallback en memoria ────────────────────────────────────────────────────
  // Se usa cuando Redis no está disponible. Cada instancia del limiter
  // tiene su propio Map privado para aislar contadores entre limiters.
  const memStore = new Map<string, RateLimitEntry>();

  // Limpieza periódica del Map para evitar que crezca indefinidamente.
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memStore.entries()) {
      if (entry.resetAt <= now) memStore.delete(key);
    }
  }, 60_000);

  /**
   * Evalúa el límite usando el Map en memoria (single-instancia).
   * @returns `{ count, resetAt }` tras incrementar el contador.
   */
  function checkMemory(key: string): { count: number; resetAt: number } {
    const now = Date.now();
    let entry = memStore.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 1, resetAt: now + windowMs };
      memStore.set(key, entry);
    } else {
      entry.count++;
    }

    return entry;
  }

  /**
   * Evalúa el límite usando Redis (multi-instancia).
   * Usa INCR + EXPIRE en pipeline para operación atómica y mínima latencia.
   * Si Redis falla en runtime, degrada al store en memoria con una advertencia.
   *
   * @returns `{ count, resetAt }` tras incrementar el contador en Redis.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function checkRedis(redis: any, key: string): Promise<{ count: number; resetAt: number }> {
    try {
      // Pipeline: INCR + EXPIRE + TTL en un solo round-trip a Redis
      const pipeline = redis.multi();
      pipeline.incr(key);
      pipeline.expire(key, windowSec, 'NX'); // NX = solo establece TTL si la clave es nueva
      pipeline.ttl(key);
      const [count, , ttl] = await pipeline.exec() as [number, unknown, number];

      // Calcular el resetAt a partir del TTL actual reportado por Redis
      const resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : windowMs);
      return { count, resetAt };
    } catch (err) {
      // Si Redis falla en runtime (timeout, desconexión), degradar a memoria
      logger.warn({ err }, 'Redis rate limit falló — degradando a store en memoria');
      return checkMemory(key);
    }
  }

  // Promesa de resolución del cliente Redis, cargada una sola vez por instancia.
  // Se resuelve a `null` si Redis no está configurado o no está disponible.
  let redisClientPromise: Promise<unknown> | null = null;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    // Clave única por prefijo + ruta + IP para separar limiters y endpoints
    const key = `${keyPrefix}:${req.path}:${ip}`;

    // Resolver el cliente Redis en la primera petición (lazy, una sola vez)
    if (!redisClientPromise) {
      redisClientPromise = getRedisClient();
    }
    const redis = await redisClientPromise;

    // Seleccionar store: Redis si está disponible, memoria en caso contrario
    const { count, resetAt } = redis
      ? await checkRedis(redis, key)
      : checkMemory(key);

    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);

    res.setHeader('X-RateLimit-Limit', max);

    if (count > max) {
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('Retry-After', retryAfter);
      // Formato de error GraphQL para que Apollo Client lo procese correctamente
      res.status(429).json({
        errors: [{ message, extensions: { code: 'TOO_MANY_REQUESTS' } }],
      });
      return;
    }

    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));
    next();
  };
}

/**
 * Límite general para todas las peticiones a la API GraphQL.
 * 200 peticiones por minuto por IP.
 */
export const generalRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  max: 200,
  keyPrefix: 'rl:api',
  message: 'Demasiadas peticiones a la API. Intenta de nuevo en un minuto.',
});

/**
 * Límite estricto para operaciones de autenticación (login/register).
 * 20 peticiones por 15 minutos por IP — protege contra ataques de fuerza bruta.
 */
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyPrefix: 'rl:auth',
  message: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.',
});
