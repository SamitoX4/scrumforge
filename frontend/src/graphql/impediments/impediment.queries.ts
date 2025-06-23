/**
 * @file impediment.queries.ts
 * @module graphql/impediments
 * @description Operaciones GraphQL para la gestión de impedimentos en ScrumForge.
 * Un impedimento es cualquier obstáculo que bloquea o ralentiza el avance del equipo
 * durante un sprint. Este módulo permite crear, consultar, asignar, actualizar el estado
 * y eliminar impedimentos, tanto a nivel de proyecto como de sprint específico.
 *
 * Se utiliza un fragmento reutilizable `ImpedimentFields` para garantizar consistencia
 * en los campos retornados por todas las operaciones de escritura y lectura.
 */

import { gql } from '@apollo/client';

/**
 * @constant IMPEDIMENT_FIELDS
 * @description Fragmento GraphQL reutilizable con todos los campos de un impedimento.
 * Se usa en las operaciones de lectura y escritura para evitar duplicación de campos
 * y garantizar que todas las respuestas tengan la misma forma de datos.
 *
 * Campos de relaciones incluidos:
 * - `reportedBy` — Usuario que reportó el impedimento (id, nombre, avatar).
 * - `assignedTo` — Usuario responsable de resolverlo (id, nombre, avatar).
 * - `resolvedBy` — Usuario que marcó el impedimento como resuelto (id, nombre, avatar).
 *
 * Campos de estado del ciclo de vida:
 * - `status` — Estado actual del impedimento (ej. OPEN, IN_PROGRESS, RESOLVED, ESCALATED).
 * - `escalatedAt` — Fecha en que se escaló el impedimento si aplica.
 * - `resolvedComment` — Comentario explicativo al resolver el impedimento.
 */
const IMPEDIMENT_FIELDS = gql`
  fragment ImpedimentFields on Impediment {
    id title description category impact status
    projectId sprintId reportedById assignedToId resolvedById
    resolvedComment escalatedAt createdAt updatedAt
    reportedBy { id name avatarUrl }
    assignedTo { id name avatarUrl }
    resolvedBy  { id name avatarUrl }
  }
`;

/**
 * @constant GET_IMPEDIMENTS
 * @description Query que obtiene la lista de impedimentos de un proyecto, con filtros opcionales
 * por sprint y por estado. Permite mostrar impedimentos del sprint activo o históricos.
 *
 * Diseño: `sprintId` y `status` son opcionales para soportar vistas de proyecto completo
 * (todos los impedimentos) y vistas filtradas (solo los abiertos del sprint actual).
 *
 * @param {ID} projectId - Proyecto del que se obtienen los impedimentos (requerido).
 * @param {ID} [sprintId] - Filtro opcional por sprint específico.
 * @param {String} [status] - Filtro opcional por estado (ej. "OPEN", "RESOLVED").
 *
 * @returns {Array<Object>} Lista de impedimentos con todos los campos del fragmento `ImpedimentFields`.
 */
export const GET_IMPEDIMENTS = gql`
  ${IMPEDIMENT_FIELDS}
  query GetImpediments($projectId: ID!, $sprintId: ID, $status: String) {
    impediments(projectId: $projectId, sprintId: $sprintId, status: $status) {
      ...ImpedimentFields
    }
  }
`;

/**
 * @constant CREATE_IMPEDIMENT
 * @description Mutación para registrar un nuevo impedimento en el sistema.
 * El input encapsula todos los campos necesarios para la creación, incluyendo
 * categoría (ej. TECHNICAL, PROCESS, EXTERNAL) e impacto estimado.
 *
 * @param {CreateImpedimentInput} input - Objeto con los datos del nuevo impedimento:
 *   título, descripción, categoría, impacto, projectId y opcionalmente sprintId.
 *
 * @returns {Object} Impedimento creado con todos los campos del fragmento `ImpedimentFields`.
 */
export const CREATE_IMPEDIMENT = gql`
  ${IMPEDIMENT_FIELDS}
  mutation CreateImpediment($input: CreateImpedimentInput!) {
    createImpediment(input: $input) { ...ImpedimentFields }
  }
`;

/**
 * @constant UPDATE_IMPEDIMENT_STATUS
 * @description Mutación para cambiar el estado de un impedimento en su ciclo de vida.
 * Cuando se resuelve un impedimento, se puede incluir un comentario explicando cómo
 * fue solucionado, lo que queda registrado en el campo `resolvedComment`.
 *
 * Diseño: se usa una mutación dedicada para cambios de estado (en lugar de una mutación
 * genérica de update) para que el backend pueda registrar la auditoría apropiada,
 * asignar `resolvedById` y validar transiciones de estado permitidas.
 *
 * @param {ID} id - Identificador del impedimento a actualizar.
 * @param {String} status - Nuevo estado a asignar (ej. "IN_PROGRESS", "RESOLVED", "ESCALATED").
 * @param {String} [resolvedComment] - Comentario opcional al resolver (recomendado cuando status="RESOLVED").
 *
 * @returns {Object} Impedimento actualizado con todos los campos del fragmento `ImpedimentFields`.
 */
export const UPDATE_IMPEDIMENT_STATUS = gql`
  ${IMPEDIMENT_FIELDS}
  mutation UpdateImpedimentStatus($id: ID!, $status: String!, $resolvedComment: String) {
    updateImpedimentStatus(id: $id, status: $status, resolvedComment: $resolvedComment) {
      ...ImpedimentFields
    }
  }
`;

/**
 * @constant ASSIGN_IMPEDIMENT
 * @description Mutación para asignar un miembro del equipo como responsable de resolver un impedimento.
 * Permite al Scrum Master delegar la resolución de impedimentos a personas específicas del equipo.
 *
 * @param {ID} id - Identificador del impedimento a asignar.
 * @param {ID} assignedToId - ID del usuario que será responsable de resolver el impedimento.
 *
 * @returns {Object} Impedimento actualizado con todos los campos del fragmento `ImpedimentFields`,
 *   incluyendo el objeto `assignedTo` con los datos del nuevo responsable.
 */
export const ASSIGN_IMPEDIMENT = gql`
  ${IMPEDIMENT_FIELDS}
  mutation AssignImpediment($id: ID!, $assignedToId: ID!) {
    assignImpediment(id: $id, assignedToId: $assignedToId) { ...ImpedimentFields }
  }
`;

/**
 * @constant DELETE_IMPEDIMENT
 * @description Mutación para eliminar permanentemente un impedimento del sistema.
 * Típicamente usada para limpiar impedimentos creados por error.
 * Retorna booleano; el frontend debe invalidar el cache o refetch la lista tras eliminar.
 *
 * @param {ID} id - Identificador del impedimento a eliminar.
 *
 * @returns {Boolean} `true` si el impedimento fue eliminado correctamente.
 */
export const DELETE_IMPEDIMENT = gql`
  mutation DeleteImpediment($id: ID!) {
    deleteImpediment(id: $id)
  }
`;
