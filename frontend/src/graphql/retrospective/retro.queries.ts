/**
 * @file retro.queries.ts
 * @module graphql/retrospective
 * @description Queries y mutations GraphQL para el módulo de retrospectivas.
 * ScrumForge soporta múltiples formatos de retrospectiva (Start/Stop/Continue,
 * 4Ls, Mad/Sad/Glad, etc.). El módulo gestiona tanto las tarjetas de feedback
 * como las acciones de mejora resultantes de la retrospectiva.
 *
 * @note Este archivo combina queries y mutations en un solo módulo porque la
 * retrospectiva es un dominio cohesivo con pocas operaciones de solo lectura.
 * El fragmento RETRO_FIELDS centraliza la forma de datos para evitar duplicación.
 */

import { gql } from '@apollo/client';

/**
 * @constant RETRO_FIELDS
 * @description Fragmento GraphQL reutilizable con la forma completa de una
 * retrospectiva. Se usa en todas las operaciones que devuelven el objeto completo
 * (listado, creación, cierre) para garantizar consistencia en el caché de Apollo.
 *
 * Campos del fragmento:
 *   - `id`, `projectId`, `sprintId` — Identificación y asociación de la retro.
 *   - `title`    — Título descriptivo de la retrospectiva.
 *   - `template` — Identificador del formato de retro (ej.: "start_stop_continue").
 *                  Determina qué columnas se muestran en la UI.
 *   - `status`   — Estado: OPEN | CLOSED.
 *   - `createdAt`— Fecha de creación.
 *   - `cards`    — Tarjetas de feedback con:
 *     - `id`, `retroId`, `column` — Identificación y columna de ubicación.
 *     - `body`     — Texto del feedback escrito por el participante.
 *     - `votes`    — Contador de votos (para priorización de items por dotmocracy).
 *     - `authorId` — ID del autor (para ocultar autoría en la fase anónima).
 *     - `createdAt`— Fecha de creación.
 *     - `author`   — Objeto `{ id, name, avatarUrl }` del autor.
 *   - `actions`  — Ítems de acción/mejora acordados con:
 *     - `id`, `retroId`, `title` — Identificación y descripción de la acción.
 *     - `assignedToId` — ID del responsable de ejecutar la acción.
 *     - `dueDate`      — Fecha límite de la acción (String ISO para compatibilidad).
 *     - `done`         — Booleano de completado (togglable desde la UI).
 *     - `storyId`      — ID de historia de usuario relacionada (si aplica).
 *     - `createdAt`    — Fecha de creación.
 *     - `assignedTo`   — Objeto `{ id, name }` del responsable.
 *
 * @note `avatarUrl` se incluye en `cards.author` pero no en `actions.assignedTo`
 * porque en la vista de acciones solo se muestra el nombre, no el avatar.
 */
const RETRO_FIELDS = gql`
  fragment RetroFields on Retrospective {
    id projectId sprintId title template status createdAt
    cards { id retroId column body votes authorId createdAt author { id name avatarUrl } }
    actions { id retroId title assignedToId dueDate done storyId createdAt assignedTo { id name } }
  }
`;

/**
 * @constant GET_RETROSPECTIVES
 * @description Obtiene todas las retrospectivas de un proyecto usando el fragmento
 * RETRO_FIELDS. Carga el contenido completo (cards + actions) de todas las retros
 * porque el historial de retrospectivas es una vista paginada donde cada retro
 * se muestra expandible con su contenido.
 *
 * @param {string} projectId — ID del proyecto cuyas retrospectivas se quieren listar.
 *
 * @returns {Object[]} Lista de retrospectivas completas usando el shape de RETRO_FIELDS.
 *
 * @note Cargar el contenido completo (cards + actions) desde el listado puede ser
 * costoso si hay muchas retros. En el futuro podría separarse en una query lazy
 * que cargue el detalle solo al expandir una retro.
 */
export const GET_RETROSPECTIVES = gql`
  ${RETRO_FIELDS}
  query GetRetrospectives($projectId: ID!) {
    retrospectives(projectId: $projectId) { ...RetroFields }
  }
`;

/**
 * @constant CREATE_RETRO
 * @description Crea una nueva retrospectiva en un proyecto. Devuelve el objeto
 * completo usando RETRO_FIELDS para que Apollo Client actualice el caché
 * de GET_RETROSPECTIVES automáticamente.
 *
 * @param {string} projectId — ID del proyecto al que pertenece la retro.
 * @param {string} title     — Título de la retrospectiva (ej.: "Sprint 5 Retro").
 * @param {string} [template]— Plantilla de formato (opcional; el backend usa
 *                             "start_stop_continue" por defecto).
 * @param {string} [sprintId]— ID del sprint asociado (opcional; permite vincular
 *                             la retro a un sprint específico para trazabilidad).
 *
 * @returns {Object} Retrospectiva recién creada con el shape de RETRO_FIELDS
 *                   (cards y actions vacíos al momento de la creación).
 */
export const CREATE_RETRO = gql`
  ${RETRO_FIELDS}
  mutation CreateRetrospective($projectId: ID!, $title: String!, $template: String, $sprintId: ID) {
    createRetrospective(projectId: $projectId, title: $title, template: $template, sprintId: $sprintId) { ...RetroFields }
  }
`;

/**
 * @constant ADD_RETRO_CARD
 * @description Añade una tarjeta de feedback a una columna de la retrospectiva.
 * Devuelve solo los campos de la tarjeta (no el objeto retro completo) para
 * optimizar el payload. La UI actualiza el caché manualmente con `cache.modify`.
 *
 * @param {string} retroId — ID de la retrospectiva a la que pertenece la tarjeta.
 * @param {string} column  — Nombre de la columna destino (ej.: "went_well", "improve").
 *                           Debe coincidir con las columnas definidas por el `template`.
 * @param {string} body    — Texto del feedback escrito por el participante.
 *
 * @returns {Object} Tarjeta creada con `{ id, retroId, column, body, votes, authorId, createdAt, author { id, name } }`.
 *
 * @note `avatarUrl` no se incluye en la respuesta de esta mutation (a diferencia
 * del fragmento RETRO_FIELDS) porque el autor de las tarjetas recién añadidas
 * ya está disponible en el contexto de sesión local.
 */
export const ADD_RETRO_CARD = gql`
  mutation AddRetroCard($retroId: ID!, $column: String!, $body: String!) {
    addRetroCard(retroId: $retroId, column: $column, body: $body) { id retroId column body votes authorId createdAt author { id name } }
  }
`;

/**
 * @constant DELETE_RETRO_CARD
 * @description Elimina una tarjeta de feedback de la retrospectiva. Solo devuelve
 * un booleano de confirmación (sin objeto de datos) porque la UI elimina la tarjeta
 * del caché local de Apollo usando `cache.evict` o `cache.modify` directamente.
 *
 * @param {string} id — ID de la tarjeta a eliminar.
 *
 * @returns {boolean} `true` si la eliminación fue exitosa.
 *
 * @note Solo el autor original o un Scrum Master puede eliminar una tarjeta.
 * Esta lógica de autorización se aplica en el resolver del backend.
 */
export const DELETE_RETRO_CARD = gql`
  mutation DeleteRetroCard($id: ID!) { deleteRetroCard(id: $id) }
`;

/**
 * @constant ADD_RETRO_ACTION
 * @description Registra una acción de mejora acordada durante la retrospectiva.
 * Las acciones son compromisos del equipo para mejorar el proceso en el próximo sprint.
 *
 * @param {string} retroId         — ID de la retrospectiva a la que pertenece la acción.
 * @param {string} title           — Descripción de la acción a tomar.
 * @param {string} [assignedToId]  — ID del responsable de ejecutar la acción (opcional).
 * @param {string} [dueDate]       — Fecha límite en formato ISO (opcional).
 *
 * @returns {Object} Acción creada con `{ id, retroId, title, done, createdAt, assignedTo { id, name } }`.
 *
 * @note `done` siempre es `false` al crear la acción. Se actualiza posteriormente
 * con TOGGLE_RETRO_ACTION.
 */
export const ADD_RETRO_ACTION = gql`
  mutation AddRetroAction($retroId: ID!, $title: String!, $assignedToId: ID, $dueDate: String) {
    addRetroAction(retroId: $retroId, title: $title, assignedToId: $assignedToId, dueDate: $dueDate) { id retroId title done createdAt assignedTo { id name } }
  }
`;

/**
 * @constant TOGGLE_RETRO_ACTION
 * @description Alterna el estado de completado de una acción de mejora.
 * Operación de bajo costo: solo devuelve `id` y `done` para actualización
 * optimista del caché sin recargar toda la retrospectiva.
 *
 * @param {string} id — ID de la acción de mejora a marcar/desmarcar como completada.
 *
 * @returns {Object} Objeto con `{ id, done }` con el nuevo estado de la acción.
 *
 * @note El diseño de devolver solo `{ id, done }` permite a Apollo Client
 * actualizar el campo `done` en el caché de forma automática gracias a la
 * normalización por `id` sin necesidad de escribir un `update` manual.
 */
export const TOGGLE_RETRO_ACTION = gql`
  mutation ToggleRetroAction($id: ID!) {
    toggleRetroAction(id: $id) { id done }
  }
`;

/**
 * @constant CLOSE_RETRO
 * @description Cierra una retrospectiva, cambiando su estado de OPEN a CLOSED.
 * Una retro cerrada no permite añadir más tarjetas ni acciones. Devuelve el
 * objeto completo con RETRO_FIELDS para que Apollo actualice el estado `status`
 * en todos los componentes que tienen la retro en caché.
 *
 * @param {string} id — ID de la retrospectiva a cerrar.
 *
 * @returns {Object} Retrospectiva actualizada con el shape de RETRO_FIELDS
 *                   y `status` igual a "CLOSED".
 *
 * @note El cierre es irreversible desde la UI (no existe una mutation de reapertura).
 * La decisión de devolver el objeto completo (en lugar de solo `{ id, status }`) es
 * deliberada: permite sincronizar cualquier cambio de último momento en cards/actions
 * que pudiera haber ocurrido en otros clientes antes del cierre.
 */
export const CLOSE_RETRO = gql`
  ${RETRO_FIELDS}
  mutation CloseRetrospective($id: ID!) {
    closeRetrospective(id: $id) { ...RetroFields }
  }
`;
