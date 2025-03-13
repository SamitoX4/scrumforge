/**
 * context.ts — Construcción del contexto GraphQL por petición.
 *
 * Apollo Server invoca `buildContext` una vez por cada petición HTTP.
 * El objeto retornado es el `context` que reciben todos los resolvers.
 *
 * El contexto incluye:
 *  - `user`: el usuario autenticado, extraído y verificado del JWT de la
 *    cabecera Authorization. Es `null` si el token falta o es inválido.
 *  - `prisma`: la instancia singleton de Prisma, lista para hacer consultas.
 *  - `workspaceId`: el workspace activo del usuario, resuelto a partir de la
 *    cabecera `X-Workspace-Slug`. Es `undefined` si el usuario no ha
 *    seleccionado un workspace o no tiene acceso al solicitado.
 *
 * Seguridad: nunca lanzar errores en `buildContext`. Los resolvers que
 * requieren autenticación usan `requireAuth(ctx)` que lanza el error
 * apropiado si `ctx.user` es `null`.
 */

import { Request } from 'express';
import { verifyToken, JwtPayload } from '../utils/crypto.utils';
import { prisma } from '../config/db/prisma.client';
import { logger } from '../utils/logger';
import { resolveTenantContext } from '../middleware/tenant.middleware';

/**
 * Datos mínimos del usuario autenticado que se propagan en el contexto.
 * Solo se incluyen los campos necesarios para la autorización, sin datos
 * sensibles como la contraseña o el refresh token.
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Contexto disponible en todos los resolvers de GraphQL.
 *
 * @property user        - Usuario autenticado, o `null` si la petición es anónima.
 * @property prisma      - Cliente de base de datos para consultas en resolvers.
 * @property workspaceId - ID del workspace activo, o `undefined` si no aplica.
 */
export interface GraphQLContext {
  user: AuthUser | null;
  prisma: typeof prisma;
  workspaceId?: string;
}

/**
 * Construye el contexto GraphQL para cada petición HTTP.
 *
 * Proceso de resolución:
 *  1. Extrae el token JWT de la cabecera `Authorization: Bearer <token>`.
 *  2. Verifica la firma y la expiración del token.
 *  3. Busca el usuario en la DB para garantizar que sigue existiendo y
 *     no ha sido eliminado/desactivado desde que se emitió el token.
 *  4. Si el usuario está autenticado, resuelve el workspace activo usando
 *     la cabecera `X-Workspace-Slug` (enviada por el frontend).
 *
 * @param req - Objeto Request de Express con cabeceras y cuerpo de la petición.
 * @returns Contexto GraphQL con usuario, prisma y workspaceId resueltos.
 */
export async function buildContext({ req }: { req: Request }): Promise<GraphQLContext> {
  let user: AuthUser | null = null;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    // Extraer el token eliminando el prefijo "Bearer "
    const token = authHeader.slice(7);
    try {
      const payload: JwtPayload = verifyToken(token);

      // Verificar que el usuario existe en la DB — el token podría ser válido
      // pero el usuario haber sido eliminado después de emitirlo.
      const dbUser = await prisma.user.findUnique({
        where: { id: payload.userId },
        // Solo cargar los campos necesarios para el contexto, no toda la entidad
        select: { id: true, email: true, name: true },
      });
      if (dbUser) user = dbUser;
    } catch {
      // Token inválido, expirado o usuario no encontrado — continuar como anónimo
      logger.debug('Token inválido o expirado');
    }
  }

  // Resolver el workspace solo si el usuario está autenticado.
  // La cabecera X-Workspace-Slug es enviada por el frontend para indicar
  // en qué workspace opera la petición actual.
  let workspaceId: string | undefined;
  if (user) {
    const workspaceSlug =
      (req.headers['x-workspace-slug'] as string | undefined) ?? undefined;
    const resolved = await resolveTenantContext(user.id, workspaceSlug, prisma);
    if (resolved) workspaceId = resolved;
  }

  return { user, prisma, workspaceId };
}
