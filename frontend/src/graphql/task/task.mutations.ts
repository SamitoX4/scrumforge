/**
 * @file task.mutations.ts
 * @module graphql/task
 * @description Mutations GraphQL para la gestión de tareas (subtareas) dentro de
 * las historias de usuario. Las tareas son el nivel de granularidad más fino en
 * ScrumForge: cada historia puede tener múltiples tareas que los desarrolladores
 * usan para dividir el trabajo técnico.
 *
 * @note Las tareas no tienen su propia vista independiente; se gestionan desde
 * el panel de detalle de la historia de usuario. Por eso estas mutations devuelven
 * el mínimo de campos necesario para actualizar el caché de Apollo sin recargar
 * la historia completa.
 */

import { gql } from '@apollo/client';

/**
 * @constant CREATE_TASK
 * @description Crea una nueva tarea (subtarea técnica) dentro de una historia de usuario.
 * Devuelve el objeto completo de la tarea creada, incluyendo el objeto `assignee`,
 * para que Apollo Client pueda añadirla al caché de GET_USER_STORY sin refetch.
 *
 * @param {Object} input — Objeto de entrada tipado como `CreateTaskInput` con:
 *   - `userStoryId` — ID de la historia de usuario padre (requerido).
 *   - `title`       — Título descriptivo de la tarea (requerido).
 *   - `assigneeId`  — ID del usuario asignado (opcional; puede asignarse después).
 *   - `order`       — Posición de la tarea dentro de la lista (opcional; por defecto al final).
 *
 * @returns {Object} Tarea creada con:
 *   - `id`         — ID asignado por el backend.
 *   - `title`      — Título confirmado por el servidor.
 *   - `status`     — Estado inicial (siempre "TODO" al crear).
 *   - `order`      — Posición calculada por el backend.
 *   - `assigneeId` — ID del asignado (como escalar para actualizaciones optimistas).
 *   - `assignee`   — Objeto `{ id, name, avatarUrl }` para renderizar el avatar inmediatamente.
 *
 * @note `assignee` se incluye en CREATE pero no en UPDATE porque al crear una tarea
 * el frontend necesita mostrar el avatar del asignado de inmediato. En la actualización,
 * el objeto `assignee` ya está en caché y Apollo lo resuelve por normalización (`id`).
 */
export const CREATE_TASK = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      id title status order assigneeId
      assignee { id name avatarUrl }
    }
  }
`;

/**
 * @constant UPDATE_TASK
 * @description Actualiza los campos de una tarea existente. Se usa para cambiar
 * el estado de la tarea (TODO → IN_PROGRESS → DONE), reasignar, editar el título
 * o reordenar las tareas dentro de la lista.
 *
 * @param {string} id     — ID de la tarea a actualizar.
 * @param {Object} input  — Objeto de entrada tipado como `UpdateTaskInput` con campos
 *                          opcionales: `title`, `status`, `assigneeId`, `order`.
 *                          Solo se envían los campos que cambian (input parcial).
 *
 * @returns {Object} Tarea actualizada con campos mínimos para sincronización de caché:
 *   - `id`         — ID para localizar el objeto en el caché de Apollo.
 *   - `title`      — Título actualizado.
 *   - `status`     — Nuevo estado de la tarea.
 *   - `order`      — Nueva posición tras reordenamiento.
 *   - `assigneeId` — Nuevo asignado (escalar; no se incluye el objeto `assignee`
 *                    completo porque Apollo lo resuelve desde la normalización de caché).
 *
 * @note A diferencia de CREATE_TASK, UPDATE_TASK no devuelve el objeto `assignee`
 * anidado. Apollo Client resuelve automáticamente la referencia al objeto `User`
 * en caché usando el `assigneeId` retornado, evitando un campo redundante en la respuesta.
 */
export const UPDATE_TASK = gql`
  mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      id title status order assigneeId
    }
  }
`;
