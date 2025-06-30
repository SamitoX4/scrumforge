/**
 * @file audit.queries.ts
 * @module graphql/audit
 * @description Operaciones GraphQL para el módulo de auditoría de ScrumForge.
 * Permite consultar el historial de cambios sobre cualquier entidad del sistema
 * y exportar los registros de auditoría de un proyecto completo en formato CSV.
 *
 * La auditoría registra quién hizo qué cambio, sobre qué entidad, cuándo y cuáles
 * fueron los valores anterior y nuevo, cumpliendo requisitos de trazabilidad y GDPR.
 */

import { gql } from '@apollo/client';

/**
 * @constant GET_AUDIT_LOG
 * @description Query que obtiene el historial de auditoría para una entidad específica del sistema.
 * Se puede usar para cualquier tipo de entidad (proyecto, historia, sprint, etc.) pasando
 * el `entityType` correspondiente. El campo `limit` permite paginar o acotar el volumen de registros.
 *
 * @param {ID} entityId - Identificador único de la entidad auditada.
 * @param {String} entityType - Tipo de entidad (ej. "Story", "Sprint", "Project").
 * @param {Int} [limit] - Número máximo de registros a retornar (opcional).
 *
 * @returns {Array<Object>} Lista de entradas de auditoría, cada una con:
 * - `id` — Identificador único del registro de auditoría.
 * - `action` — Tipo de acción realizada (ej. CREATE, UPDATE, DELETE).
 * - `field` — Campo modificado (relevante para acciones de tipo UPDATE).
 * - `oldValue` — Valor anterior del campo antes del cambio.
 * - `newValue` — Valor nuevo del campo tras el cambio.
 * - `createdAt` — Fecha y hora en que se realizó el cambio.
 * - `entityType` — Tipo de entidad sobre la que se realizó el cambio.
 * - `user` — Usuario que realizó la acción, con `id`, `name` y `avatarUrl`.
 */
export const GET_AUDIT_LOG = gql`
  query GetAuditLog($entityId: ID!, $entityType: String!, $limit: Int) {
    auditLog(entityId: $entityId, entityType: $entityType, limit: $limit) {
      id action field oldValue newValue createdAt entityType
      user { id name avatarUrl }
    }
  }
`;

/**
 * @constant EXPORT_AUDIT_CSV
 * @description Query que genera y retorna el contenido CSV con todos los registros de auditoría
 * de un proyecto completo. El CSV incluye todas las entidades del proyecto (historias, sprints, etc.)
 * y es útil para reportes de cumplimiento, revisiones externas o backups de trazabilidad.
 *
 * Diseño: se implementa como query (no mutation) porque es una operación de solo lectura;
 * el CSV se genera en el servidor y se devuelve como string para descarga desde el frontend.
 *
 * @param {ID} projectId - Identificador del proyecto cuya auditoría se exporta.
 *
 * @returns {String} Contenido del archivo CSV con todos los registros de auditoría del proyecto.
 */
export const EXPORT_AUDIT_CSV = gql`
  query ExportProjectAuditCsv($projectId: ID!) {
    exportProjectAuditCsv(projectId: $projectId)
  }
`;
