/**
 * @file impediment.typedefs.ts
 * @module impediment
 * @description Definición del esquema GraphQL para el módulo de impedimentos.
 *
 * Un impedimento es cualquier obstáculo que bloquea o ralentiza el avance
 * del equipo Scrum. Tiene categoría (p.ej. TECHNICAL, PROCESS), impacto
 * (LOW, MEDIUM, HIGH, CRITICAL), y un estado que evoluciona desde OPEN
 * hasta RESOLVED.
 *
 * Los campos de auditoría (`reportedBy`, `assignedTo`, `resolvedBy`) se
 * resuelven como relaciones al tipo `User`.
 *
 * El campo `escalatedAt` se establece automáticamente cuando el impedimento
 * lleva más de 2 días sin resolverse, disparando una notificación al Product Owner.
 */
export const impedimentTypeDefs = `#graphql
  """
  Impedimento que bloquea o ralentiza el progreso del equipo durante un sprint.
  """
  type Impediment {
    id:              ID!
    title:           String!
    description:     String
    """ Categoría del impedimento (p.ej. TECHNICAL, PROCESS, DEPENDENCY). """
    category:        String!
    """ Nivel de impacto sobre el sprint (LOW, MEDIUM, HIGH, CRITICAL). """
    impact:          String!
    """ Estado actual (OPEN, IN_PROGRESS, RESOLVED). """
    status:          String!
    projectId:       String!
    """ Sprint al que está asociado (opcional). """
    sprintId:        String
    """ ID del usuario que reportó el impedimento. """
    reportedById:    String!
    """ ID del usuario asignado para resolver el impedimento (opcional). """
    assignedToId:    String
    """ ID del usuario que resolvió el impedimento (opcional). """
    resolvedById:    String
    """ Comentario explicativo del cierre/resolución (opcional). """
    resolvedComment: String
    """ Fecha en que el impedimento fue escalado por superar 2 días sin resolver. """
    escalatedAt: DateTime
    createdAt:       String!
    updatedAt:       String!
    """ Usuario que reportó el impedimento. """
    reportedBy:      User!
    """ Usuario asignado para resolver el impedimento. """
    assignedTo:      User
    """ Usuario que resolvió el impedimento. """
    resolvedBy:      User
  }

  """
  Input para crear un nuevo impedimento. Solo el título y el projectId son obligatorios.
  """
  input CreateImpedimentInput {
    title:       String!
    description: String
    category:    String
    impact:      String
    projectId:   ID!
    sprintId:    ID
    assignedToId: ID
  }

  extend type Query {
    """ Retorna impedimentos de un proyecto con filtros opcionales de sprint y estado. """
    impediments(projectId: ID!, sprintId: ID, status: String): [Impediment!]!
    """ Retorna un impedimento concreto por su ID. """
    impediment(id: ID!): Impediment
  }

  extend type Mutation {
    """ Crea un nuevo impedimento; el reportador se infiere del usuario autenticado. """
    createImpediment(input: CreateImpedimentInput!): Impediment!
    """ Actualiza el estado de un impedimento; puede incluir comentario de resolución. """
    updateImpedimentStatus(id: ID!, status: String!, resolvedComment: String): Impediment!
    """ Asigna el impedimento a un miembro del equipo para su resolución. """
    assignImpediment(id: ID!, assignedToId: ID!): Impediment!
    """ Elimina un impedimento por su ID. """
    deleteImpediment(id: ID!): Boolean!
  }
`;
