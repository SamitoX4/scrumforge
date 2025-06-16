/**
 * @file retro.typedefs.ts
 * @module retrospective
 * @description Definición del esquema GraphQL para el módulo de retrospectivas.
 *
 * Define tres tipos principales:
 * - `RetroCard`: tarjeta de feedback creada por un participante en una columna.
 * - `RetroAction`: acción de mejora acordada con responsable y fecha límite.
 * - `Retrospective`: sesión completa que agrupa tarjetas y acciones.
 *
 * El campo `votes` en `RetroCard` permite la funcionalidad de dot-voting,
 * donde los participantes votan las tarjetas más relevantes para discutir.
 *
 * El campo `template` en `Retrospective` determina las columnas disponibles
 * (p.ej. START_STOP_CONTINUE usa tres columnas: Start, Stop, Continue).
 */
export const retroTypeDefs = `#graphql
  """
  Tarjeta de feedback aportada por un participante en una columna específica.
  """
  type RetroCard {
    id:       ID!
    retroId:  String!
    """ Columna donde se ubica la tarjeta (p.ej. START, STOP, CONTINUE). """
    column:   String!
    """ Texto de la tarjeta (sanitizado y limitado a 2000 caracteres). """
    body:     String!
    authorId: String!
    """ Número de votos recibidos mediante dot-voting. """
    votes:    Int!
    createdAt: DateTime!
    """ Datos del autor resueltos como relación. """
    author:   User!
  }

  """
  Acción de mejora comprometida durante la retrospectiva.
  Puede tener un responsable asignado y una fecha límite.
  """
  type RetroAction {
    id:           ID!
    retroId:      String!
    """ Descripción de la acción de mejora (máximo 500 caracteres). """
    title:        String!
    assignedToId: String
    dueDate:      String
    """ Indica si la acción fue completada. """
    done:         Boolean!
    """ Historia de usuario relacionada (si la acción genera una nueva historia). """
    storyId:      String
    createdAt:    String!
    """ Usuario responsable de ejecutar la acción. """
    assignedTo:   User
  }

  """
  Sesión de retrospectiva de un proyecto o sprint.
  Agrupa tarjetas de feedback y acciones de mejora.
  """
  type Retrospective {
    id:         ID!
    projectId:  String!
    """ Sprint asociado (opcional; puede ser una retro independiente). """
    sprintId:   String
    title:      String!
    """ Plantilla que define las columnas disponibles (p.ej. START_STOP_CONTINUE). """
    template:   String!
    """ Estado de la sesión: OPEN (activa) o CLOSED (finalizada). """
    status:     String!
    createdAt:  String!
    """ Tarjetas ordenadas por votos descendente. """
    cards:      [RetroCard!]!
    """ Acciones de mejora ordenadas cronológicamente. """
    actions:    [RetroAction!]!
  }

  extend type Query {
    """ Retorna todas las retrospectivas de un proyecto. """
    retrospectives(projectId: ID!): [Retrospective!]!
    """ Retorna una retrospectiva específica por ID. """
    retrospective(id: ID!): Retrospective
  }

  extend type Mutation {
    """ Crea una nueva sesión de retrospectiva en estado OPEN. """
    createRetrospective(projectId: ID!, title: String!, template: String, sprintId: ID): Retrospective!
    """ Agrega una tarjeta a la columna especificada de la retrospectiva. """
    addRetroCard(retroId: ID!, column: String!, body: String!): RetroCard!
    """ Elimina una tarjeta de la retrospectiva. """
    deleteRetroCard(id: ID!): Boolean!
    """ Agrega una acción de mejora a la retrospectiva. """
    addRetroAction(retroId: ID!, title: String!, assignedToId: ID, dueDate: DateTime): RetroAction!
    """ Alterna el estado completado/pendiente de una acción de mejora. """
    toggleRetroAction(id: ID!): RetroAction!
    """ Cierra la retrospectiva (estado CLOSED); no acepta más cambios. """
    closeRetrospective(id: ID!): Retrospective!
  }
`;
