/**
 * @file backlog.queries.ts
 * @module graphql/backlog
 * @description Queries GraphQL para la gestión del backlog del producto. Incluye la
 * obtención de épicas, historias de usuario del backlog y el detalle completo de una
 * historia individual. Estas queries alimentan las vistas de BacklogView y el panel
 * de detalle de historia de usuario.
 */

import { gql } from '@apollo/client';

/**
 * @constant GET_EPICS
 * @description Obtiene todas las épicas pertenecientes a un proyecto.
 * Las épicas actúan como agrupadores de alto nivel para las historias de usuario.
 * Se usa principalmente en el panel lateral del backlog y en los selectores de
 * épica al crear/editar historias.
 *
 * @param {string} projectId — ID del proyecto al que pertenecen las épicas.
 *
 * @returns {Object[]} Lista de épicas con:
 *   - `id`          — Identificador único.
 *   - `title`       — Nombre de la épica.
 *   - `description` — Descripción opcional de la épica.
 *   - `priority`    — Nivel de prioridad (CRITICAL, HIGH, MEDIUM, LOW).
 *   - `color`       — Color HEX asignado para identificación visual en el tablero.
 *   - `order`       — Posición de ordenamiento manual dentro del proyecto.
 *   - `createdAt`   — Fecha de creación.
 *
 * @note El campo `color` es clave para la visualización: las historias del backlog
 * muestran el color de su épica como indicador visual de agrupación.
 */
export const GET_EPICS = gql`
  query GetEpics($projectId: ID!) {
    epics(projectId: $projectId) {
      id title description priority color order createdAt
    }
  }
`;

/**
 * @constant GET_BACKLOG
 * @description Obtiene la lista de historias de usuario del backlog de un proyecto.
 * Incluye las relaciones con épica y asignado para evitar consultas adicionales
 * en la vista de listado. Las historias sin `sprintId` son las que pertenecen
 * exclusivamente al backlog (no asignadas a ningún sprint activo).
 *
 * @param {string} projectId — ID del proyecto cuyo backlog se quiere consultar.
 *
 * @returns {Object[]} Lista de historias de usuario con:
 *   - `id`, `title`, `description` — Identificación básica de la historia.
 *   - `status`      — Estado actual (TODO, IN_PROGRESS, IN_REVIEW, DONE).
 *   - `points`      — Story points estimados (puede ser null si no se estimó).
 *   - `priority`    — Prioridad de negocio.
 *   - `order`       — Orden de priorización dentro del backlog.
 *   - `epicId`      — ID de la épica padre (puede ser null).
 *   - `sprintId`    — ID del sprint al que está asignada (null = backlog puro).
 *   - `assigneeId`  — ID del usuario asignado (puede ser null).
 *   - `createdAt`   — Fecha de creación.
 *   - `epic`        — Objeto con `id`, `title` y `color` para mostrar la etiqueta de épica.
 *   - `assignee`    — Objeto con `id`, `name` y `avatarUrl` para el avatar del asignado.
 *
 * @note Se incluyen `epicId` y `assigneeId` como escalares además de los objetos
 * relacionados `epic` y `assignee` para facilitar operaciones de actualización
 * optimista en Apollo Client sin necesidad de des-normalizar los objetos.
 */
export const GET_BACKLOG = gql`
  query GetBacklog($projectId: ID!) {
    backlog(projectId: $projectId) {
      id title description status points priority order epicId sprintId assigneeId createdAt
      epic { id title color }
      assignee { id name avatarUrl }
    }
  }
`;

/**
 * @constant GET_USER_STORY
 * @description Obtiene el detalle completo de una historia de usuario individual.
 * Esta query se usa en el panel lateral de detalle y en la vista de edición.
 * Trae más datos que GET_BACKLOG porque incluye las tareas hijas, el sprint
 * asignado, fechas de actualización y campos personalizados.
 *
 * @param {string} id — ID único de la historia de usuario a consultar.
 *
 * @returns {Object} Historia de usuario con todos sus campos y relaciones:
 *   - `id`, `title`, `description` — Identificación básica.
 *   - `status`, `points`, `priority`, `order` — Estado y métricas de planificación.
 *   - `epicId`, `sprintId`, `assigneeId` — IDs de relaciones para actualizaciones.
 *   - `createdAt`, `updatedAt` — Auditoría temporal (updatedAt no se incluye en GET_BACKLOG).
 *   - `customFields`  — Objeto JSON con campos personalizados del proyecto (escalar JSON).
 *   - `epic`          — Épica padre: `{ id, title, color }`.
 *   - `sprint`        — Sprint asignado: `{ id, name, status }` para mostrar en cabecera.
 *   - `assignee`      — Usuario asignado: `{ id, name, avatarUrl }`.
 *   - `tasks`         — Lista de tareas hijas con `{ id, title, status, assigneeId, order, assignee }`.
 *
 * @note `customFields` es un escalar `JSON` que puede contener cualquier estructura
 * definida por el equipo a nivel de proyecto. Se renderiza dinámicamente en el
 * panel de detalle.
 *
 * @note `updatedAt` se incluye aquí (no en GET_BACKLOG) porque en la vista de detalle
 * se muestra la última modificación, mientras que en el listado del backlog ese
 * dato no es relevante para la UX.
 */
export const GET_USER_STORY = gql`
  query GetUserStory($id: ID!) {
    userStory(id: $id) {
      id title description status points priority order epicId sprintId assigneeId createdAt updatedAt customFields
      epic { id title color }
      sprint { id name status }
      assignee { id name avatarUrl }
      tasks { id title status assigneeId order assignee { id name avatarUrl } }
    }
  }
`;
