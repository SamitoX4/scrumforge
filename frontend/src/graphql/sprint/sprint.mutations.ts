/**
 * @fileoverview Mutaciones GraphQL del módulo Sprint.
 *
 * Gestiona el ciclo de vida completo de un sprint: creación, inicio,
 * finalización y eliminación. El flujo normal es:
 *   1. `CREATE_SPRINT` — sprint en estado PLANNED
 *   2. `START_SPRINT` — pasa a estado ACTIVE (solo puede haber uno activo a la vez por proyecto)
 *   3. `COMPLETE_SPRINT` — pasa a estado COMPLETED, con opción de migrar historias incompletas
 *   4. `DELETE_SPRINT` — elimina sprints que nunca se iniciaron (PLANNED) o ya completados
 */

import { gql } from '@apollo/client';

/**
 * Crea un nuevo sprint en estado PLANNED para un proyecto.
 *
 * El sprint se crea sin fechas activas obligatoriamente (pueden quedar
 * pendientes hasta el momento del inicio). El `goal` es el objetivo del
 * sprint expresado de forma concisa para orientar al equipo. Se incluye
 * `projectId` en la respuesta para facilitar la actualización de la caché
 * de Apollo sin tener que recargar toda la lista de sprints del proyecto.
 *
 * @param $input {CreateSprintInput} - Datos del sprint: nombre, objetivo,
 *   fechas de inicio/fin (opcionales) y projectId.
 * @returns Sprint creado con campos completos de estado y fechas.
 */
export const CREATE_SPRINT = gql`
  mutation CreateSprint($input: CreateSprintInput!) {
    createSprint(input: $input) {
      id name goal status startDate endDate projectId
    }
  }
`;

/**
 * Inicia un sprint planificado y lo pone en estado ACTIVE.
 *
 * Solo puede existir un sprint activo por proyecto en todo momento; el
 * servidor rechazará esta operación si ya existe otro sprint activo.
 * Las fechas de inicio y fin pueden ajustarse en este momento a través
 * de `StartSprintInput`, incluso si ya se habían definido al crear el sprint.
 *
 * @param $id {ID} - Identificador del sprint a iniciar.
 * @param $input {StartSprintInput} - Fechas definitivas de inicio y fin
 *   del sprint (pueden sobrescribir las definidas en la creación).
 * @returns Sprint actualizado con estado ACTIVE y fechas confirmadas.
 */
export const START_SPRINT = gql`
  mutation StartSprint($id: ID!, $input: StartSprintInput!) {
    startSprint(id: $id, input: $input) {
      id name goal status startDate endDate
    }
  }
`;

/**
 * Finaliza el sprint activo y gestiona las historias incompletas.
 *
 * Las historias de usuario que no llegaron a estado DONE al cerrar el
 * sprint pueden migrarse automáticamente a otro sprint usando
 * `moveIncompleteToSprintId`. Si este parámetro se omite o es `null`,
 * las historias incompletas regresan al backlog general (sin sprint).
 *
 * Este comportamiento de migración sigue la ceremonia de cierre de sprint
 * de Scrum, donde el equipo decide qué hacer con el trabajo no completado.
 *
 * @param $id {ID} - Identificador del sprint activo a completar.
 * @param $moveIncompleteToSprintId {ID?} - Sprint destino para historias
 *   no completadas. Si se omite, las historias vuelven al backlog.
 * @returns Sprint con estado COMPLETED y nombre (para mostrar en UI).
 */
export const COMPLETE_SPRINT = gql`
  mutation CompleteSprint($id: ID!, $moveIncompleteToSprintId: ID) {
    completeSprint(id: $id, moveIncompleteToSprintId: $moveIncompleteToSprintId) {
      id name status
    }
  }
`;

/**
 * Elimina un sprint permanentemente.
 *
 * Solo se pueden eliminar sprints en estado PLANNED (nunca iniciados) o
 * COMPLETED. El servidor rechazará la eliminación de un sprint ACTIVE para
 * evitar la pérdida accidental de trabajo en curso.
 *
 * Al eliminar un sprint PLANNED, sus historias de usuario asociadas
 * regresan automáticamente al backlog sin sprint.
 *
 * @param $id {ID} - Identificador del sprint a eliminar.
 * @returns Boolean indicando si la eliminación fue exitosa.
 */
export const DELETE_SPRINT = gql`
  mutation DeleteSprint($id: ID!) {
    deleteSprint(id: $id)
  }
`;
