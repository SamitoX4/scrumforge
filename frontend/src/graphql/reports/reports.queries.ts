/**
 * @file reports.queries.ts
 * @module graphql/reports
 * @description Queries GraphQL y suscripciones para los reportes de métricas ágiles.
 * Contiene el burndown chart del sprint activo y el reporte de velocidad histórica
 * del proyecto. También incluye la suscripción en tiempo real para el burndown,
 * permitiendo que el gráfico se actualice automáticamente cuando cambia el estado
 * de las historias durante el sprint.
 *
 * @note Este archivo combina queries y suscripciones en un solo módulo porque
 * ambas comparten la misma forma de datos del burndown, facilitando la reutilización
 * del mismo tipo de respuesta en la vista de reportes.
 */

import { gql } from '@apollo/client';

/**
 * @constant GET_BURNDOWN
 * @description Obtiene los datos del gráfico burndown para un sprint específico.
 * El burndown chart muestra la evolución del trabajo restante vs. la línea ideal
 * a lo largo de los días del sprint, siendo un artefacto visual clave en Scrum
 * para detectar desviaciones tempranamente.
 *
 * @param {string} sprintId — ID del sprint del que se quiere obtener el burndown.
 *
 * @returns {Object} Datos del reporte con:
 *   - `totalPoints`  — Puntos totales comprometidos al inicio del sprint (línea base).
 *   - `sprint`       — Metadatos del sprint: `{ id, name, startDate, endDate }`.
 *                      Se incluye para que el componente pueda calcular los días
 *                      del eje X sin una query adicional.
 *   - `points`       — Array de puntos de datos diarios con:
 *     - `date`            — Fecha del día (escalar Date).
 *     - `remainingPoints` — Puntos de trabajo pendientes al final de ese día (línea real).
 *     - `idealPoints`     — Puntos que deberían quedar si el ritmo fuera perfecto (línea ideal).
 *
 * @note `idealPoints` es calculado por el backend con una reducción lineal desde
 * `totalPoints` hasta 0 entre `startDate` y `endDate`. El componente Recharts
 * muestra ambas líneas solapadas para visualizar la desviación.
 */
export const GET_BURNDOWN = gql`
  query GetBurndown($sprintId: ID!) {
    burndownReport(sprintId: $sprintId) {
      totalPoints
      sprint { id name startDate endDate }
      points { date remainingPoints idealPoints }
    }
  }
`;

/**
 * @constant GET_VELOCITY
 * @description Obtiene el reporte de velocidad histórica del equipo para un proyecto.
 * La velocidad mide cuántos puntos completa el equipo por sprint, siendo el indicador
 * principal para estimar la capacidad futura durante el sprint planning.
 *
 * @param {string} projectId  — ID del proyecto del que se quiere medir la velocidad.
 * @param {number} [lastSprints] — Número de sprints pasados a incluir en el análisis
 *                                 (opcional; el backend usa un valor por defecto si se omite).
 *
 * @returns {Object} Reporte de velocidad con:
 *   - `projectId`       — ID del proyecto (para validar la respuesta en caché).
 *   - `averageVelocity` — Promedio de puntos completados por sprint en el período analizado.
 *   - `sprints`         — Array de datos por sprint con:
 *     - `sprintId`       — ID del sprint.
 *     - `sprintName`     — Nombre del sprint para el eje X del gráfico de barras.
 *     - `completedPoints`— Puntos efectivamente completados (barras del gráfico).
 *     - `plannedPoints`  — Puntos comprometidos al inicio del sprint para comparación.
 *
 * @note La comparación entre `completedPoints` y `plannedPoints` permite detectar
 * patrones de sobre/sub-estimación del equipo a lo largo de los sprints.
 */
export const GET_VELOCITY = gql`
  query GetVelocity($projectId: ID!, $lastSprints: Int) {
    velocityReport(projectId: $projectId, lastSprints: $lastSprints) {
      projectId
      averageVelocity
      sprints { sprintId sprintName completedPoints plannedPoints }
    }
  }
`;

/**
 * @constant BURNDOWN_UPDATED
 * @description Suscripción en tiempo real que recibe actualizaciones del burndown
 * cada vez que cambia el estado de una historia de usuario del sprint. Permite que
 * el gráfico de burndown se actualice automáticamente sin necesidad de recargar
 * la página cuando el equipo mueve tarjetas en el tablero.
 *
 * @param {string} sprintId — ID del sprint al que suscribirse para recibir actualizaciones.
 *
 * @returns {Object} Mismo shape que `GET_BURNDOWN.burndownReport` para que Apollo Client
 * pueda actualizar el caché de la query de forma transparente:
 *   - `totalPoints`  — Puntos totales (puede cambiar si se añaden/quitan historias).
 *   - `sprint`       — Metadatos del sprint `{ id, name, startDate, endDate }`.
 *   - `points`       — Array de puntos diarios actualizados `{ date, remainingPoints, idealPoints }`.
 *
 * @note Esta suscripción emite el dataset completo del burndown (no solo el delta)
 * para evitar la complejidad de merge incremental en el cliente. El backend publica
 * en el canal `BURNDOWN_UPDATED(sprintId)` cada vez que se completa o reactiva
 * una historia del sprint.
 *
 * @note El shape de respuesta es idéntico a GET_BURNDOWN intencionalmente: permite
 * usar `subscribeToMore` de Apollo para actualizar el caché de la query principal.
 */
export const BURNDOWN_UPDATED = gql`
  subscription BurndownUpdated($sprintId: ID!) {
    burndownUpdated(sprintId: $sprintId) {
      totalPoints
      sprint { id name startDate endDate }
      points { date remainingPoints idealPoints }
    }
  }
`;

