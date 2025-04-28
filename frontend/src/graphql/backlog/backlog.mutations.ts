/**
 * @fileoverview Mutaciones GraphQL del módulo Backlog.
 *
 * Agrupa todas las operaciones de escritura relacionadas con épicas,
 * historias de usuario y la organización del backlog de un proyecto.
 * Estas mutaciones se consumen a través de Apollo Client en los
 * componentes y hooks del backlog.
 */

import { gql } from '@apollo/client';

/**
 * Crea una nueva épica dentro de un proyecto.
 *
 * Las épicas son agrupaciones de alto nivel que contienen historias de
 * usuario relacionadas. Se devuelven los campos necesarios para insertar
 * la épica directamente en la caché local sin recargar el listado completo.
 *
 * @param $input {CreateEpicInput} - Datos de la nueva épica (título,
 *   descripción, prioridad, color, orden y projectId).
 * @returns Épica creada con su identificador y metadatos esenciales.
 */
export const CREATE_EPIC = gql`
  mutation CreateEpic($input: CreateEpicInput!) {
    createEpic(input: $input) {
      id title description priority color order projectId
    }
  }
`;

/**
 * Actualiza los campos de una épica existente.
 *
 * No devuelve `projectId` porque el proyecto nunca cambia tras la
 * creación; solo se retornan los campos editables para actualizar la
 * caché de forma optimista.
 *
 * @param $id {ID} - Identificador de la épica a modificar.
 * @param $input {UpdateEpicInput} - Campos a actualizar (título,
 *   descripción, prioridad, color u orden).
 * @returns Épica actualizada.
 */
export const UPDATE_EPIC = gql`
  mutation UpdateEpic($id: ID!, $input: UpdateEpicInput!) {
    updateEpic(id: $id, input: $input) {
      id title description priority color order
    }
  }
`;

/**
 * Elimina una épica y redistribuye sus historias de usuario.
 *
 * Cuando se borra una épica que contiene historias, se puede especificar
 * `targetEpicId` para reasignarlas a otra épica en lugar de dejarlas
 * sin épica (huérfanas). Si se omite, las historias quedan en el backlog
 * sin agrupación.
 *
 * @param $id {ID} - Identificador de la épica a eliminar.
 * @param $targetEpicId {ID?} - Épica destino para migrar las historias
 *   contenidas. Opcional: si no se pasa, las historias quedan sin épica.
 * @returns Boolean indicando si la operación fue exitosa.
 */
export const DELETE_EPIC = gql`
  mutation DeleteEpic($id: ID!, $targetEpicId: ID) {
    deleteEpic(id: $id, targetEpicId: $targetEpicId)
  }
`;

/**
 * Crea una nueva historia de usuario en el backlog.
 *
 * Se incluye `sprintId` en la respuesta para permitir que el cliente
 * coloque la historia directamente en un sprint o en el backlog general
 * sin necesidad de una consulta adicional.
 *
 * @param $input {CreateUserStoryInput} - Datos de la historia (título,
 *   descripción, estado, puntos, prioridad, orden, epicId, projectId
 *   y opcionalmente sprintId).
 * @returns Historia creada con todos los campos de posicionamiento.
 */
export const CREATE_USER_STORY = gql`
  mutation CreateUserStory($input: CreateUserStoryInput!) {
    createUserStory(input: $input) {
      id title description status points priority order epicId projectId sprintId
    }
  }
`;

/**
 * Actualiza los campos de una historia de usuario existente.
 *
 * Incluye `customFields` en la respuesta porque el usuario puede
 * modificar campos personalizados del proyecto (ej. "criterios de
 * aceptación" o campos de negocio específicos). Se omite `projectId`
 * al igual que en UPDATE_EPIC ya que es inmutable.
 *
 * @param $id {ID} - Identificador de la historia a modificar.
 * @param $input {UpdateUserStoryInput} - Campos a actualizar.
 * @returns Historia actualizada con campos de asignación y posición.
 */
export const UPDATE_USER_STORY = gql`
  mutation UpdateUserStory($id: ID!, $input: UpdateUserStoryInput!) {
    updateUserStory(id: $id, input: $input) {
      id title description status points priority order epicId sprintId assigneeId customFields
    }
  }
`;

/**
 * Elimina permanentemente una historia de usuario.
 *
 * Esta operación es irreversible. El cliente debe solicitar confirmación
 * al usuario antes de invocarla.
 *
 * @param $id {ID} - Identificador de la historia a eliminar.
 * @returns Boolean indicando si la eliminación fue exitosa.
 */
export const DELETE_USER_STORY = gql`
  mutation DeleteUserStory($id: ID!) {
    deleteUserStory(id: $id)
  }
`;

/**
 * Mueve una historia de usuario a un sprint o la devuelve al backlog.
 *
 * Cuando `sprintId` es `null` o se omite, la historia regresa al
 * backlog general (sin sprint asignado). Esto permite el arrastre
 * desde el tablero o el backlog hacia cualquier sprint visible.
 *
 * @param $storyId {ID} - Identificador de la historia a mover.
 * @param $sprintId {ID?} - Sprint destino. Pasar `null` para devolver
 *   la historia al backlog.
 * @returns Historia con su nuevo `sprintId` actualizado.
 */
export const MOVE_TO_SPRINT = gql`
  mutation MoveToSprint($storyId: ID!, $sprintId: ID) {
    moveToSprint(storyId: $storyId, sprintId: $sprintId) {
      id sprintId
    }
  }
`;

/**
 * Bloquea una historia de usuario indicando el motivo del impedimento.
 *
 * Una historia bloqueada no puede avanzar de estado hasta que sea
 * desbloqueada. El campo `blockedReason` se muestra en el tablero
 * Kanban como indicador visual de impedimento.
 *
 * @param $id {ID} - Identificador de la historia a bloquear.
 * @param $reason {String} - Descripción obligatoria del motivo del bloqueo.
 * @returns Historia con `isBlocked: true` y el motivo registrado.
 */
export const BLOCK_STORY = gql`
  mutation BlockStory($id: ID!, $reason: String!) {
    blockStory(id: $id, reason: $reason) {
      id isBlocked blockedReason
    }
  }
`;

/**
 * Desbloquea una historia de usuario y registra el comentario de resolución.
 *
 * A diferencia de `BLOCK_STORY`, aquí el campo se llama `comment` para
 * diferenciar semánticamente la resolución del impedimento original.
 * El comentario queda en el historial pero `blockedReason` se limpia.
 *
 * @param $id {ID} - Identificador de la historia a desbloquear.
 * @param $comment {String} - Comentario obligatorio explicando la resolución.
 * @returns Historia con `isBlocked: false` y `blockedReason` vacío.
 */
export const UNBLOCK_STORY = gql`
  mutation UnblockStory($id: ID!, $comment: String!) {
    unblockStory(id: $id, comment: $comment) {
      id isBlocked blockedReason
    }
  }
`;

/**
 * Reordena una historia dentro del backlog, con soporte de reordenamiento
 * entre épicas.
 *
 * El servidor calcula la nueva posición de todas las historias afectadas
 * (las que quedan por encima o debajo) y devuelve únicamente la historia
 * desplazada con su nuevo orden. El cliente actualiza la caché de Apollo
 * con el resultado para mantener la UI consistente sin recargar el backlog.
 *
 * `targetEpicId` permite mover una historia a una épica diferente en el
 * mismo gesto de arrastre (cambio de grupo + posición simultáneo).
 *
 * @param $projectId {ID} - Proyecto al que pertenece el backlog.
 * @param $storyId {ID} - Historia que se está reordenando.
 * @param $newPosition {Int} - Índice basado en 0 de la nueva posición.
 * @param $targetEpicId {ID?} - Si se arrastra a otra épica, su ID destino.
 * @returns Historia reordenada con `order` y `epicId` actualizados.
 */
export const REORDER_BACKLOG = gql`
  mutation ReorderBacklog($projectId: ID!, $storyId: ID!, $newPosition: Int!, $targetEpicId: ID) {
    reorderBacklog(projectId: $projectId, storyId: $storyId, newPosition: $newPosition, targetEpicId: $targetEpicId) {
      id order epicId
    }
  }
`;

/**
 * Reordena la lista de épicas de un proyecto.
 *
 * Se envía el array completo de IDs en el nuevo orden, no solo los
 * elementos desplazados. Esto evita conflictos de concurrencia al
 * hacer el reordenamiento atómico en el servidor.
 *
 * @param $projectId {ID} - Proyecto dueño de las épicas.
 * @param $orderedIds {[ID!]!} - Array de IDs de épicas en el orden final deseado.
 * @returns Lista de épicas con sus valores `order` actualizados.
 */
export const REORDER_EPICS = gql`
  mutation ReorderEpics($projectId: ID!, $orderedIds: [ID!]!) {
    reorderEpics(projectId: $projectId, orderedIds: $orderedIds) {
      id order
    }
  }
`;
