/**
 * prisma.client.ts — Instancia singleton de PrismaClient.
 *
 * Se crea una única instancia de PrismaClient para toda la aplicación
 * (patrón Singleton) para evitar agotar el pool de conexiones de PostgreSQL.
 *
 * En entornos de desarrollo con hot-reload (ts-node-dev, tsx watch, etc.)
 * cada reinicio del módulo crearía una nueva instancia y abriría nuevas
 * conexiones al pool. Para evitarlo, se guarda la instancia en `globalThis`,
 * que persiste entre recargas del módulo pero se reinicia con el proceso.
 *
 * En producción no se usa `globalThis` porque los reinicios del módulo
 * no ocurren, y así evitamos filtrar referencias entre peticiones.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { logger } from '../../utils/logger';

/**
 * Crea una nueva instancia de PrismaClient usando el driver de PostgreSQL
 * nativo (`pg`) a través del adaptador oficial `@prisma/adapter-pg`.
 *
 * Se usa el adaptador pg (en lugar de la conexión interna de Prisma) para
 * beneficiarse de la gestión del pool de conexiones de `pg` y para
 * compatibilidad con PgBouncer en modos de transacción.
 *
 * El nivel de logging se ajusta según el entorno:
 * - Desarrollo: se loguean todas las queries con su duración para facilitar
 *   la detección de consultas lentas o N+1.
 * - Producción: solo advertencias y errores para no saturar los logs.
 */
function createPrismaClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaPg(pool as any);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
        : ['warn', 'error'],
  });
}

// Singleton pattern — una única instancia en toda la app.
// El cast a `unknown` es necesario porque TypeScript no permite extender
// `globalThis` con propiedades arbitrarias sin una declaración de tipo.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Reusar la instancia existente (si hay hot-reload en dev) o crear una nueva
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Escuchar el evento 'query' para logear cada consulta SQL en desarrollo.
// Se hace aquí (fuera de createPrismaClient) porque el listener se registra
// sobre la instancia ya creada, no sobre el constructor.
if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma as any).$on('query', (e: { query: string; duration: number }) => {
    logger.debug({ query: e.query, duration: e.duration }, 'Prisma query');
  });
}

// Solo guardar en globalThis fuera de producción para evitar memory leaks
// en producción donde el módulo nunca se recarga.
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
