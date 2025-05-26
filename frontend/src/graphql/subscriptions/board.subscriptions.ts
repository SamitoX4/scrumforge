/**
 * @file board.subscriptions.ts
 * @module graphql/subscriptions
 * @description Suscripciones GraphQL para actualizaciones en tiempo real del tablero
 * y del sistema de notificaciones. Estas suscripciones usan el transporte WebSocket
 * configurado en Apollo Client mediante el split link (`graphql-ws`), que enruta
 * automáticamente las suscripciones al endpoint WS y las queries/mutations al HTTP.
 *
 * @note El canal de notificaciones (NOTIFICATION_ADDED) está en este archivo junto
 * con el tablero porque ambas suscripciones son las primeras que se activan al
 * entrar al workspace, aunque conceptualmente pertenecen a dominios distintos.
 */

import { gql } from '@apollo/client';

/**
 * @constant BOARD_UPDATED
 * @description Suscripción en tiempo real que recibe actualizaciones de historias
 * de usuario del tablero cuando cualquier miembro del equipo realiza cambios.
 * Permite que múltiples usuarios trabajen simultáneamente en el tablero Kanban
 * viendo los cambios de los demás sin necesidad de recargar la página.
 *
 * @param {string} projectId — ID del proyecto cuyo tablero se quiere observar.
 *                             El backend usa este parámetro para suscribir al cliente
 *                             solo al canal del proyecto correspondiente y evitar
 *                             recibir eventos de otros proyectos del workspace.
 *
 * @returns {Object} Delta de la historia de usuario actualizada con solo los campos
 * que pueden cambiar desde el tablero (diseño deliberadamente minimalista):
 *   - `id`         — ID de la historia actualizada. Permite a Apollo Client localizar
 *                    el objeto en caché para actualizarlo por normalización.
 *   - `status`     — Nuevo estado tras mover la tarjeta entre columnas.
 *                    Es el campo que cambia con más frecuencia (drag & drop).
 *   - `assigneeId` — Nuevo asignado si el usuario reasignó la tarjeta en el tablero.
 *   - `points`     — Story points por si se editaron inline desde el tablero.
 *   - `sprintId`   — ID del sprint, útil si la historia fue movida a otro sprint.
 *
 * @note El payload es intencionalmente pequeño (no incluye `title`, `description`,
 * ni `tasks`): solo los campos modificables directamente desde el tablero. Los
 * campos de solo lectura en el tablero no necesitan sincronizarse en tiempo real.
 *
 * @note El backend publica en el canal `BOARD_UPDATED(projectId)` cada vez que
 * se ejecuta `updateUserStory` o `moveUserStory` en el resolver del tablero.
 */
export const BOARD_UPDATED = gql`
  subscription BoardUpdated($projectId: ID!) {
    boardUpdated(projectId: $projectId) {
      id
      status
      assigneeId
      points
      sprintId
    }
  }
`;

/**
 * @constant NOTIFICATION_ADDED
 * @description Suscripción global que recibe nuevas notificaciones en tiempo real
 * para el usuario autenticado. No requiere parámetros porque el backend filtra
 * las notificaciones por el usuario identificado en el JWT del WebSocket.
 *
 * @returns {Object} Objeto de notificación recibida con:
 *   - `id`        — ID único de la notificación para deduplicación.
 *   - `type`      — Tipo de evento que generó la notificación (ej.: "ASSIGNED",
 *                   "MENTIONED", "SPRINT_STARTED", "STORY_BLOCKED"). Determina
 *                   el icono y el mensaje de la notificación en la UI.
 *   - `payload`   — Escalar JSON con contexto adicional dependiente del `type`
 *                   (ej.: `{ storyId, storyTitle, actorName }` para ASSIGNED).
 *   - `readAt`    — Timestamp de cuando fue leída (null = no leída). Se usa para
 *                   mostrar el indicador de notificaciones sin leer.
 *   - `createdAt` — Timestamp de creación para ordenamiento cronológico.
 *
 * @note `payload` es un escalar JSON de forma libre porque los distintos tipos de
 * notificación tienen estructuras de datos muy diferentes. El componente de
 * notificaciones interpreta `payload` según el valor de `type` para construir
 * el mensaje humanizado.
 *
 * @note `readAt` se incluye en el evento de creación (siempre null) para permitir
 * la actualización optimista del contador de no leídas sin esperar una query adicional.
 */
export const NOTIFICATION_ADDED = gql`
  subscription NotificationAdded {
    notificationAdded {
      id
      type
      payload
      readAt
      createdAt
    }
  }
`;
