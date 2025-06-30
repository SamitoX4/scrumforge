/**
 * @file audit.typedefs.ts
 * @module audit
 * @description Definición del esquema GraphQL para el módulo de auditoría.
 *
 * Define el tipo `AuditLogEntry` que representa una entrada de registro
 * de cambios, y extiende el tipo `Query` con tres consultas:
 * - `auditLog`: historial de una entidad concreta.
 * - `projectAuditLog`: historial de todas las entidades de un proyecto.
 * - `exportProjectAuditCsv`: exportación en formato CSV.
 *
 * El campo `user` se resuelve mediante la relación de Prisma y contiene
 * los datos básicos del usuario que realizó la acción.
 */
export const auditTypeDefs = `#graphql
  """
  Entrada individual del log de auditoría.
  Registra quién hizo qué y cuándo sobre una entidad del sistema.
  """
  type AuditLogEntry {
    id:         ID!
    """ Tipo de entidad afectada (p.ej. "Task", "UserStory"). """
    entityType: String!
    """ Identificador de la entidad afectada. """
    entityId:   String!
    """ Tipo de acción realizada (CREATED, DELETED, STATUS_CHANGED, etc.). """
    action:     String!
    """ Nombre del campo modificado; presente solo para FIELD_UPDATED. """
    field:      String
    """ Valor anterior del campo; presente cuando aplica. """
    oldValue:   String
    """ Nuevo valor del campo; presente cuando aplica. """
    newValue:   String
    userId:     String!
    projectId:  String!
    createdAt:  String!
    """ Usuario que realizó la acción, resuelto como relación. """
    user:       User!
  }

  extend type Query {
    """ Retorna el historial de una entidad específica. """
    auditLog(entityId: ID!, entityType: String!, limit: Int): [AuditLogEntry!]!
    """ Retorna el historial completo de un proyecto. """
    projectAuditLog(projectId: ID!, limit: Int): [AuditLogEntry!]!
    """ Exporta el historial del proyecto como texto CSV. """
    exportProjectAuditCsv(projectId: ID!): String!
  }
`;
