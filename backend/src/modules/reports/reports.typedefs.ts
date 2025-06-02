/**
 * @file reports.typedefs.ts
 * @module reports
 * @description Definición del esquema GraphQL para el módulo de reportes.
 *
 * Define los tipos de datos necesarios para dos reportes ágiles clave:
 *
 * **Burndown Chart**: muestra el trabajo restante vs. el ideal day-by-day
 * durante un sprint. Cada `BurndownPoint` es un punto en la curva.
 *
 * **Velocity Report**: muestra la capacidad histórica del equipo comparando
 * puntos completados vs. planificados en los últimos N sprints.
 *
 * La suscripción `burndownUpdated` permite actualizar el gráfico en tiempo real
 * cuando se completan tareas o historias durante el sprint.
 */
export const reportsTypeDefs = `#graphql
  """
  Punto individual de la curva de burndown.
  Representa el estado del sprint en una fecha concreta.
  """
  type BurndownPoint {
    """ Fecha del punto en formato ISO 8601. """
    date: String!
    """ Puntos de historia que quedan por completar en esa fecha. """
    remainingPoints: Int!
    """ Puntos ideales que deberían quedar según la velocidad lineal esperada. """
    idealPoints: Float!
  }

  """
  Datos de velocidad para un sprint específico.
  Permite comparar lo planificado con lo realmente completado.
  """
  type VelocityData {
    sprintId: String!
    sprintName: String!
    """ Puntos de historia completados al cierre del sprint. """
    completedPoints: Int!
    """ Puntos de historia que se habían comprometido al inicio del sprint. """
    plannedPoints: Int!
  }

  """
  Reporte completo de burndown para un sprint.
  Incluye la curva de progreso, el sprint relacionado y el total de puntos.
  """
  type BurndownReport {
    """ Sprint al que pertenece este reporte. """
    sprint: Sprint!
    """ Serie de puntos que forman la curva de burndown. """
    points: [BurndownPoint!]!
    """ Total de puntos comprometidos al inicio del sprint. """
    totalPoints: Int!
  }

  """
  Reporte de velocidad histórica de un proyecto.
  Agrega los datos de los últimos N sprints y calcula la velocidad promedio.
  """
  type VelocityReport {
    projectId: String!
    """ Datos por sprint usados para calcular la velocidad. """
    sprints: [VelocityData!]!
    """ Promedio de puntos completados por sprint. """
    averageVelocity: Float!
  }

  extend type Query {
    """ Genera el reporte de burndown para un sprint específico. """
    burndownReport(sprintId: ID!): BurndownReport!
    """ Genera el reporte de velocidad para los últimos N sprints del proyecto. """
    velocityReport(projectId: ID!, lastSprints: Int): VelocityReport!
  }

  extend type Subscription {
    """ Emite una actualización del burndown en tiempo real cuando cambia el sprint. """
    burndownUpdated(sprintId: ID!): BurndownReport
  }
`;
