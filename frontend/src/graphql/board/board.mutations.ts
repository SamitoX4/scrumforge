/**
 * @fileoverview Mutaciones GraphQL del módulo Board (tablero Kanban).
 *
 * Contiene las operaciones de escritura para configurar las columnas del
 * tablero Kanban de un proyecto. La actualización de columnas es la única
 * mutación de configuración del tablero: el resto de operaciones del board
 * (mover tarjetas) se realiza a través de las mutaciones de historias de
 * usuario y tareas en sus respectivos módulos.
 */

import { gql } from '@apollo/client';

/**
 * Actualiza la configuración completa de las columnas del tablero Kanban.
 *
 * Esta mutación reemplaza la lista de columnas del proyecto de forma
 * atómica: se envía el array completo con el estado deseado (crear,
 * editar o eliminar columnas) en una sola operación. Esto evita
 * inconsistencias que surgirían de aplicar cambios individuales.
 *
 * El campo `wipLimit` (Work In Progress Limit) limita la cantidad de
 * historias que puede haber activas en esa columna simultáneamente,
 * un mecanismo clave en metodología Kanban para detectar cuellos de
 * botella. Un valor `null` significa sin límite.
 *
 * El campo `status` mapea cada columna a un estado interno de historia
 * (ej. "TODO", "IN_PROGRESS", "DONE"), permitiendo que el sistema sepa
 * qué estado asignar automáticamente cuando una historia se arrastra a
 * esa columna.
 *
 * @param $projectId {ID} - Proyecto cuyo tablero se está configurando.
 * @param $columns {[BoardColumnInput!]!} - Array completo con la nueva
 *   configuración de columnas. Cada elemento puede incluir: título,
 *   estado asociado, color, orden y límite WIP.
 * @returns Lista de columnas actualizadas con todos sus campos de
 *   visualización y configuración.
 */
export const UPDATE_BOARD_COLUMNS = gql`
  mutation UpdateBoardColumns($projectId: ID!, $columns: [BoardColumnInput!]!) {
    updateBoardColumns(projectId: $projectId, columns: $columns) {
      id
      title
      status
      color
      order
      wipLimit
    }
  }
`;
