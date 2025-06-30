/**
 * @file dependency.queries.ts
 * @module graphql/dependencies
 * @description Operaciones GraphQL para la gestión de dependencias entre historias de usuario.
 * Las dependencias permiten modelar relaciones entre historias (ej. "esta historia requiere
 * que otra esté completa primero"), lo que facilita la planificación de sprints y la
 * identificación de posibles bloqueos en el flujo de trabajo del equipo.
 *
 * Cada dependencia tiene un `type` que describe la naturaleza de la relación
 * (ej. BLOCKS, DEPENDS_ON, RELATED_TO) y referencias bidireccionales a las historias involucradas.
 */

import { gql } from '@apollo/client';

/**
 * @constant GET_STORY_DEPENDENCIES
 * @description Query que obtiene todas las dependencias asociadas a una historia de usuario,
 * tanto las que salen de ella (fromStory) como las que llegan a ella (toStory).
 * Incluye datos resumidos de las historias relacionadas para mostrar contexto en la UI
 * sin necesidad de queries adicionales.
 *
 * @param {ID} storyId - Identificador de la historia cuyas dependencias se consultan.
 *
 * @returns {Array<Object>} Lista de dependencias con:
 * - `id` — Identificador único de la dependencia.
 * - `type` — Tipo de relación entre las historias (ej. "BLOCKS", "DEPENDS_ON").
 * - `fromStoryId` — ID de la historia de origen de la dependencia.
 * - `toStoryId` — ID de la historia de destino de la dependencia.
 * - `createdAt` — Fecha de creación de la dependencia.
 * - `fromStory` — Objeto con `id`, `title` y `status` de la historia origen.
 * - `toStory` — Objeto con `id`, `title` y `status` de la historia destino.
 */
export const GET_STORY_DEPENDENCIES = gql`
  query GetStoryDependencies($storyId: ID!) {
    storyDependencies(storyId: $storyId) {
      id type fromStoryId toStoryId createdAt
      fromStory { id title status }
      toStory   { id title status }
    }
  }
`;

/**
 * @constant ADD_DEPENDENCY
 * @description Mutación para crear una nueva dependencia entre dos historias de usuario.
 * La dirección de la dependencia es significativa: `fromStoryId` es la historia que
 * depende de (o bloquea a) `toStoryId`, según el `type` especificado.
 *
 * No incluye `createdAt` en la respuesta porque el frontend solo necesita actualizar
 * el grafo de dependencias con los datos esenciales tras la creación.
 *
 * @param {ID} fromStoryId - ID de la historia de origen (quien depende o quien bloquea).
 * @param {ID} toStoryId - ID de la historia de destino (de quien depende o a quien bloquea).
 * @param {String} type - Tipo de relación (ej. "BLOCKS", "DEPENDS_ON", "RELATED_TO").
 *
 * @returns {Object} Dependencia creada con:
 * - `id`, `type`, `fromStoryId`, `toStoryId`.
 * - `fromStory` — Objeto con `id`, `title` y `status` de la historia origen.
 * - `toStory` — Objeto con `id`, `title` y `status` de la historia destino.
 */
export const ADD_DEPENDENCY = gql`
  mutation AddDependency($fromStoryId: ID!, $toStoryId: ID!, $type: String!) {
    addDependency(fromStoryId: $fromStoryId, toStoryId: $toStoryId, type: $type) {
      id type fromStoryId toStoryId
      fromStory { id title status }
      toStory   { id title status }
    }
  }
`;

/**
 * @constant REMOVE_DEPENDENCY
 * @description Mutación para eliminar una dependencia existente entre dos historias.
 * Retorna booleano; el frontend debe actualizar el cache de Apollo o refetch las dependencias
 * de la historia afectada para mantener el grafo de dependencias sincronizado.
 *
 * @param {ID} id - Identificador único de la dependencia a eliminar.
 *
 * @returns {Boolean} `true` si la dependencia fue eliminada correctamente.
 */
export const REMOVE_DEPENDENCY = gql`
  mutation RemoveDependency($id: ID!) {
    removeDependency(id: $id)
  }
`;
