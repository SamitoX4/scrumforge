/**
 * @file sprint.queries.ts
 * @module graphql/sprint
 * @description Queries GraphQL para la gestión y visualización de sprints. Contiene
 * tanto el listado histórico de todos los sprints del proyecto como la query detallada
 * del sprint activo, que es la fuente de datos principal para el tablero Kanban y la
 * vista de sprint en curso.
 */

import { gql } from '@apollo/client';

/**
 * @constant GET_SPRINTS
 * @description Obtiene el historial completo de sprints de un proyecto, incluyendo
 * estadísticas agregadas de cada sprint. Se utiliza en la vista de listado de sprints,
 * selectores de sprint y la pantalla de reportes de velocidad.
 *
 * @param {string} projectId — ID del proyecto cuyos sprints se quieren listar.
 *
 * @returns {Object[]} Lista de sprints con:
 *   - `id`, `name`   — Identificación del sprint.
 *   - `goal`         — Objetivo del sprint definido en el sprint planning (puede ser null).
 *   - `status`       — Estado: PLANNED | ACTIVE | COMPLETED.
 *   - `startDate`    — Fecha de inicio (escalar Date).
 *   - `endDate`      — Fecha de fin planificada (escalar Date).
 *   - `createdAt`    — Fecha de creación del registro.
 *   - `stats`        — Objeto de estadísticas calculadas por el backend:
 *     - `totalPoints`       — Total de puntos planificados en el sprint.
 *     - `completedPoints`   — Puntos correspondientes a historias en estado DONE.
 *     - `totalStories`      — Número total de historias de usuario en el sprint.
 *     - `completedStories`  — Número de historias completadas.
 *     - `progressPercent`   — Porcentaje de avance calculado (0-100).
 *
 * @note `stats` no se almacena en base de datos; es calculado dinámicamente por el
 * resolver del backend para evitar inconsistencias por actualizaciones parciales.
 */
export const GET_SPRINTS = gql`
  query GetSprints($projectId: ID!) {
    sprints(projectId: $projectId) {
      id name goal status startDate endDate createdAt
      stats { totalPoints completedPoints totalStories completedStories progressPercent }
    }
  }
`;

/**
 * @constant GET_ACTIVE_SPRINT
 * @description Obtiene el sprint activo de un proyecto junto con todas sus historias
 * de usuario y tareas. Esta es la query principal del tablero Kanban: combina la
 * configuración del sprint con el contenido para renderizar las tarjetas en columnas.
 *
 * @param {string} projectId — ID del proyecto cuyo sprint activo se quiere consultar.
 *
 * @returns {Object | null} Sprint activo o null si no hay ninguno activo:
 *   - `id`, `name`, `goal` — Datos de cabecera del sprint.
 *   - `status`             — Siempre "ACTIVE" si existe un sprint activo.
 *   - `startDate`, `endDate` — Fechas para mostrar la duración y días restantes.
 *   - `stats`              — Mismo objeto de estadísticas que en GET_SPRINTS.
 *   - `userStories`        — Lista completa de historias del sprint con:
 *     - `id`, `title`, `description` — Contenido de la tarjeta.
 *     - `status`       — Determina en qué columna del tablero se ubica la tarjeta.
 *     - `points`       — Story points para calcular capacidad y velocidad.
 *     - `priority`     — Nivel de prioridad para ordenamiento visual.
 *     - `order`        — Posición de la historia dentro de su columna.
 *     - `assigneeId`   — ID del asignado (como escalar para actualizaciones optimistas).
 *     - `isBlocked`    — Booleano que activa el indicador visual de bloqueo.
 *     - `blockedReason`— Texto explicativo del bloqueo (null si no está bloqueada).
 *     - `assignee`     — Objeto `{ id, name, avatarUrl }` para renderizar el avatar.
 *     - `tasks`        — Subtareas con `{ id, title, status }` para la barra de progreso
 *                        de tareas en la tarjeta (se usan en modo colapsado).
 *
 * @note `isBlocked` y `blockedReason` son campos específicos del módulo de impedimentos
 * de ScrumForge. Se incluyen aquí para mostrar el estado de bloqueo directamente en
 * el tablero sin necesidad de una query adicional.
 *
 * @note Las tareas (`tasks`) solo traen `id`, `title` y `status` (sin `order` ni
 * `assignee` completo) porque en el tablero solo se usa el conteo y el estado general.
 * El detalle completo de tareas se obtiene en GET_USER_STORY del backlog.
 */
export const GET_ACTIVE_SPRINT = gql`
  query GetActiveSprint($projectId: ID!) {
    activeSprint(projectId: $projectId) {
      id name goal status startDate endDate
      stats { totalPoints completedPoints totalStories completedStories progressPercent }
      userStories {
        id title description status points priority order assigneeId isBlocked blockedReason
        assignee { id name avatarUrl }
        tasks { id title status }
      }
    }
  }
`;
