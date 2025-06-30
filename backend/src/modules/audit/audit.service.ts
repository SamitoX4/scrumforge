/**
 * @file audit.service.ts
 * @module audit
 * @description Servicio de auditoría responsable de registrar y consultar
 * el historial de cambios sobre entidades del sistema.
 *
 * El registro de auditoría es **no-fatal**: los errores al escribir un log
 * se silencian para no interrumpir el flujo principal de negocio.
 */

import { PrismaClient } from '@prisma/client';

/**
 * Tipos de acciones auditables en el sistema.
 * - CREATED: La entidad fue creada.
 * - DELETED: La entidad fue eliminada.
 * - STATUS_CHANGED: El estado de la entidad cambió.
 * - FIELD_UPDATED: Un campo específico fue modificado.
 * - ASSIGNED: La entidad fue asignada a un usuario.
 */
export type AuditAction = 'CREATED' | 'DELETED' | 'STATUS_CHANGED' | 'FIELD_UPDATED' | 'ASSIGNED';

/**
 * @class AuditService
 * @description Encapsula la lógica de lectura y escritura de la tabla `AuditLog`.
 * Recibe el cliente Prisma como dependencia para permitir pruebas unitarias
 * con mocks y para respetar el contexto transaccional de cada request.
 */
export class AuditService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Registra una entrada en el log de auditoría.
   * El método nunca lanza excepciones: si la escritura falla, el error
   * se captura y descarta silenciosamente para no bloquear la operación
   * que originó el evento.
   *
   * @param params - Datos de la entrada de auditoría.
   * @param params.entityType - Tipo de la entidad afectada (p.ej. "Task").
   * @param params.entityId - ID de la entidad afectada.
   * @param params.action - Tipo de acción realizada.
   * @param params.field - Campo modificado (solo para FIELD_UPDATED).
   * @param params.oldValue - Valor anterior del campo.
   * @param params.newValue - Nuevo valor del campo.
   * @param params.userId - ID del usuario que realizó la acción.
   * @param params.projectId - ID del proyecto al que pertenece la entidad.
   * @returns La entrada de auditoría creada, o undefined si hubo error.
   */
  async log(params: {
    entityType: string;
    entityId: string;
    action: AuditAction;
    field?: string;
    oldValue?: string;
    newValue?: string;
    userId: string;
    projectId: string;
  }) {
    return this.db.auditLog.create({ data: params }).catch(() => {
      // Non-fatal: audit log must never break the main flow
    });
  }

  /**
   * Recupera los registros de auditoría de una entidad concreta,
   * ordenados de más reciente a más antiguo. Incluye información
   * reducida del usuario (id, nombre, avatar) para mostrar en UI.
   *
   * @param entityId - ID de la entidad a consultar.
   * @param entityType - Tipo de la entidad (p.ej. "UserStory").
   * @param limit - Límite de registros a retornar (por defecto 50).
   * @returns Lista de entradas de auditoría con datos de usuario embebidos.
   */
  async getEntityLog(entityId: string, entityType: string, limit = 50) {
    return this.db.auditLog.findMany({
      where: { entityId, entityType },
      orderBy: { createdAt: 'desc' },
      take: limit,
      // Solo se seleccionan campos necesarios del usuario para evitar
      // exponer datos sensibles en la respuesta
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  /**
   * Recupera todos los registros de auditoría de un proyecto,
   * sin filtrar por tipo de entidad. Útil para la vista de actividad
   * global del proyecto.
   *
   * @param projectId - ID del proyecto.
   * @param limit - Límite de registros (por defecto 100).
   * @returns Lista de entradas de auditoría del proyecto.
   */
  async getProjectLog(projectId: string, limit = 100) {
    return this.db.auditLog.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  /**
   * Exporta hasta 5 000 registros de auditoría de un proyecto
   * como una cadena de texto en formato CSV con encabezados en español.
   *
   * Cada celda se envuelve en comillas dobles y las comillas internas
   * se escapan duplicándolas (estándar RFC 4180).
   *
   * @param projectId - ID del proyecto a exportar.
   * @returns Cadena CSV con encabezado y filas de datos separados por saltos de línea.
   */
  async exportProjectLogCsv(projectId: string): Promise<string> {
    // Se recuperan hasta 5 000 registros para exportación masiva
    const logs = await this.getProjectLog(projectId, 5000);

    // Encabezado con nombres de columna en español
    const header = 'fecha,usuario,tipo,id,accion,campo,valor_anterior,valor_nuevo';

    const rows = logs.map((l) =>
      [
        l.createdAt.toISOString(),
        l.user.name,
        l.entityType,
        l.entityId,
        l.action,
        l.field ?? '',        // Campo opcional: vacío si no aplica
        l.oldValue ?? '',     // Valor anterior opcional
        l.newValue ?? '',     // Valor nuevo opcional
      ]
        // Cada valor se envuelve en comillas y las comillas internas se escapan
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );

    // Se une el encabezado con las filas mediante salto de línea Unix
    return [header, ...rows].join('\n');
  }
}
