/**
 * @file dod.queries.ts
 * @module graphql/dod
 * @description Operaciones GraphQL para la gestión de la Definition of Done (DoD) de un proyecto.
 * La DoD es una lista ordenada de criterios que toda historia de usuario debe cumplir
 * para considerarse completada. Cada elemento es un texto libre que el equipo define.
 *
 * El campo `order` permite al equipo priorizar y reordenar los ítems de la DoD visualmente.
 */

import { gql } from '@apollo/client';

/**
 * @constant GET_DOD_ITEMS
 * @description Query que obtiene todos los ítems de la Definition of Done de un proyecto,
 * ordenados por el campo `order` para respetar la secuencia definida por el equipo.
 *
 * @param {ID} projectId - Identificador del proyecto cuya DoD se consulta.
 *
 * @returns {Array<Object>} Lista de ítems de DoD, cada uno con:
 * - `id` — Identificador único del ítem.
 * - `text` — Descripción del criterio de terminación.
 * - `projectId` — Proyecto al que pertenece el ítem.
 * - `order` — Posición del ítem en la lista ordenada.
 * - `createdAt` — Fecha de creación del ítem.
 */
export const GET_DOD_ITEMS = gql`
  query GetDodItems($projectId: ID!) {
    dodItems(projectId: $projectId) {
      id text projectId order createdAt
    }
  }
`;

/**
 * @constant CREATE_DOD_ITEM
 * @description Mutación para añadir un nuevo ítem a la Definition of Done de un proyecto.
 * El backend asigna automáticamente el valor de `order` al final de la lista existente.
 *
 * @param {ID} projectId - Proyecto al que se añade el ítem.
 * @param {String} text - Texto descriptivo del nuevo criterio de terminación.
 *
 * @returns {Object} Ítem creado con todos sus campos: `id`, `text`, `projectId`, `order`, `createdAt`.
 */
export const CREATE_DOD_ITEM = gql`
  mutation CreateDodItem($projectId: ID!, $text: String!) {
    createDodItem(projectId: $projectId, text: $text) {
      id text projectId order createdAt
    }
  }
`;

/**
 * @constant UPDATE_DOD_ITEM
 * @description Mutación para actualizar el texto de un ítem existente en la DoD.
 * El campo `text` es opcional para permitir actualizaciones parciales, aunque en la
 * práctica siempre se envía ya que es el único campo editable desde la UI.
 * No incluye `createdAt` en la respuesta porque no cambia al actualizar.
 *
 * @param {ID} id - Identificador del ítem a actualizar.
 * @param {String} [text] - Nuevo texto del criterio (opcional en el schema, requerido en la UI).
 *
 * @returns {Object} Ítem actualizado con: `id`, `text`, `projectId`, `order`.
 */
export const UPDATE_DOD_ITEM = gql`
  mutation UpdateDodItem($id: ID!, $text: String) {
    updateDodItem(id: $id, text: $text) {
      id text projectId order
    }
  }
`;

/**
 * @constant DELETE_DOD_ITEM
 * @description Mutación para eliminar permanentemente un ítem de la Definition of Done.
 * Retorna booleano; el frontend debe actualizar el cache de Apollo o refetch la lista
 * tras una eliminación exitosa para mantener la UI sincronizada.
 *
 * @param {ID} id - Identificador del ítem a eliminar.
 *
 * @returns {Boolean} `true` si el ítem fue eliminado correctamente.
 */
export const DELETE_DOD_ITEM = gql`
  mutation DeleteDodItem($id: ID!) {
    deleteDodItem(id: $id)
  }
`;
