/**
 * @file audit.resolver.ts
 * @module audit
 * @description Resolvers de GraphQL para el módulo de auditoría.
 * Expone queries que permiten consultar el historial de acciones
 * realizadas sobre entidades del sistema (historias, tareas, etc.)
 * y exportar esos registros en formato CSV.
 *
 * Todos los resolvers exigen autenticación previa mediante `requireAuth`.
 */

import { GraphQLContext } from '../../graphql/context';
import { AuditService } from './audit.service';
import { requireAuth } from '../../middleware/auth.middleware';

/**
 * Crea una instancia de AuditService vinculada al cliente Prisma
 * del contexto de la petición actual. Se instancia por resolver
 * para garantizar que cada request use su propia conexión de BD.
 *
 * @param ctx - Contexto de GraphQL que contiene el cliente Prisma.
 * @returns Nueva instancia de AuditService.
 */
function makeService(ctx: GraphQLContext) {
  return new AuditService(ctx.prisma);
}

/**
 * Mapa de resolvers del módulo de auditoría.
 * Se registra en el esquema combinado de Apollo Server.
 */
export const auditResolvers = {
  Query: {
    /**
     * Devuelve el historial de auditoría de una entidad específica
     * (por ejemplo, una historia de usuario o una tarea).
     *
     * @param _ - Parent resolver; no utilizado.
     * @param entityId - Identificador único de la entidad auditada.
     * @param entityType - Tipo de entidad (p.ej. "UserStory", "Task").
     * @param limit - Número máximo de registros a retornar (por defecto 50 en el servicio).
     * @param ctx - Contexto GraphQL con usuario autenticado y cliente Prisma.
     * @returns Lista de entradas de auditoría ordenadas de más reciente a más antigua.
     */
    async auditLog(
      _: unknown,
      { entityId, entityType, limit }: { entityId: string; entityType: string; limit?: number },
      ctx: GraphQLContext,
    ) {
      // Verifica que haya un usuario autenticado antes de proceder
      requireAuth(ctx);
      return makeService(ctx).getEntityLog(entityId, entityType, limit);
    },

    /**
     * Devuelve el historial de auditoría completo de un proyecto,
     * incluyendo todos los tipos de entidades que le pertenecen.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param projectId - Identificador del proyecto a consultar.
     * @param limit - Número máximo de registros (por defecto 100 en el servicio).
     * @param ctx - Contexto GraphQL con usuario autenticado y cliente Prisma.
     * @returns Lista de entradas de auditoría del proyecto.
     */
    async projectAuditLog(
      _: unknown,
      { projectId, limit }: { projectId: string; limit?: number },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx);
      return makeService(ctx).getProjectLog(projectId, limit);
    },

    /**
     * Exporta hasta 5 000 registros de auditoría de un proyecto
     * en formato CSV (texto plano con encabezados en español).
     *
     * @param _ - Parent resolver; no utilizado.
     * @param projectId - Identificador del proyecto a exportar.
     * @param ctx - Contexto GraphQL con usuario autenticado y cliente Prisma.
     * @returns Cadena de texto CSV lista para descarga.
     */
    async exportProjectAuditCsv(
      _: unknown,
      { projectId }: { projectId: string },
      ctx: GraphQLContext,
    ) {
      requireAuth(ctx);
      return makeService(ctx).exportProjectLogCsv(projectId);
    },
  },
};
