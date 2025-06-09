/**
 * @fileoverview Operaciones GraphQL del módulo de notificaciones.
 *
 * Centraliza queries y mutaciones para el sistema de notificaciones
 * del usuario. Las notificaciones informan sobre eventos relevantes
 * (asignaciones, menciones, cambios de estado, etc.) y tienen un
 * ciclo de vida simple: se crean en el servidor, se leen aquí y se
 * marcan como leídas.
 *
 * El campo `payload` es un objeto JSON libre que varía según el `type`
 * de notificación, permitiendo que cada tipo incluya datos contextuales
 * específicos sin necesidad de columnas adicionales en la base de datos.
 */

import { gql } from '@apollo/client';

/**
 * Obtiene la lista de notificaciones del usuario autenticado.
 *
 * El parámetro `limit` permite paginar para evitar cargar un número
 * excesivo de notificaciones. El campo `readAt` es `null` si la
 * notificación no ha sido leída, lo que permite filtrar y contar
 * las no leídas en el cliente.
 *
 * @param $limit {Int?} - Número máximo de notificaciones a devolver.
 *   Si se omite, el servidor aplica su propio límite por defecto.
 * @returns Lista de notificaciones con tipo, datos contextuales y fechas.
 */
export const GET_NOTIFICATIONS = gql`
  query GetNotifications($limit: Int) {
    notifications(limit: $limit) {
      id
      type
      payload
      readAt
      createdAt
    }
  }
`;

/**
 * Obtiene únicamente el contador de notificaciones no leídas.
 *
 * Se usa de forma independiente a `GET_NOTIFICATIONS` para actualizar
 * el badge del ícono de campana sin cargar el contenido completo de
 * las notificaciones. Esto es más eficiente para las actualizaciones
 * frecuentes del contador (ej. polling o subscriptions).
 *
 * @returns Número entero con la cantidad de notificaciones sin leer.
 */
export const GET_UNREAD_COUNT = gql`
  query GetUnreadNotificationCount {
    unreadNotificationCount
  }
`;

/**
 * Marca una notificación individual como leída.
 *
 * El servidor registra la fecha y hora exacta en `readAt` al ejecutar
 * esta mutación. Se devuelve el `readAt` actualizado para que Apollo
 * pueda actualizar la caché local sin recargar la lista completa,
 * lo que permite la transición visual inmediata en la UI.
 *
 * @param $id {ID} - Identificador de la notificación a marcar como leída.
 * @returns Notificación con su `readAt` actualizado.
 */
export const MARK_NOTIFICATION_READ = gql`
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id) {
      id
      readAt
    }
  }
`;

/**
 * Marca todas las notificaciones del usuario como leídas en una sola operación.
 *
 * Más eficiente que llamar a `MARK_NOTIFICATION_READ` por cada notificación
 * individualmente. El servidor establece `readAt` en el momento actual para
 * todas las notificaciones no leídas del usuario autenticado. Tras esta
 * mutación el cliente debe invalidar o refrescar la caché de
 * `GET_NOTIFICATIONS` y `GET_UNREAD_COUNT`.
 *
 * @returns Boolean indicando si la operación fue exitosa.
 */
export const MARK_ALL_NOTIFICATIONS_READ = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;
