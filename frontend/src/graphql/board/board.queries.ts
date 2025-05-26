/**
 * @file board.queries.ts
 * @module graphql/board
 * @description Queries GraphQL para la configuración y visualización del tablero
 * Kanban/Scrum de un proyecto. Las columnas del tablero son entidades configurables
 * que mapean estados de las historias de usuario a una representación visual ordenada.
 * Las actualizaciones en tiempo real del tablero se manejan en board.subscriptions.ts.
 */

import { gql } from '@apollo/client';

/**
 * @constant GET_BOARD_COLUMNS
 * @description Obtiene la configuración de columnas del tablero Kanban de un proyecto.
 * Cada columna representa un estado del flujo de trabajo y puede tener un límite WIP
 * (Work In Progress) para aplicar restricciones Kanban.
 *
 * @param {string} projectId — ID del proyecto cuyas columnas de tablero se quieren obtener.
 *
 * @returns {Object[]} Lista de columnas ordenadas por `order` con:
 *   - `id`       — Identificador único de la columna.
 *   - `title`    — Nombre visible de la columna (ej.: "En Progreso", "En Revisión").
 *   - `status`   — Valor de estado canónico que mapea con el campo `status` de las
 *                  historias de usuario (ej.: "IN_PROGRESS", "IN_REVIEW", "DONE").
 *                  Este campo es la clave de unión entre columnas y tarjetas del tablero.
 *   - `color`    — Color HEX de la cabecera de columna para diferenciación visual.
 *   - `order`    — Número de ordenamiento para renderizar las columnas de izquierda
 *                  a derecha en el tablero.
 *   - `wipLimit` — Límite máximo de tarjetas simultáneas en la columna (0 o null = sin límite).
 *                  Se usa para mostrar advertencias visuales cuando se supera el límite.
 *
 * @note Las tarjetas (historias de usuario) que se muestran dentro de cada columna
 * se obtienen a través de GET_ACTIVE_SPRINT en sprint.queries.ts. Esta query solo
 * define la estructura/configuración del tablero, no su contenido.
 *
 * @note `wipLimit` es un campo de diseño Kanban; en flujos Scrum puros suele
 * ignorarse. Se incluye siempre para no requerir una query distinta según metodología.
 */
export const GET_BOARD_COLUMNS = gql`
  query GetBoardColumns($projectId: ID!) {
    boardColumns(projectId: $projectId) {
      id
      title
      status
      color
      order
      wipLimit
    }
  }
`;
