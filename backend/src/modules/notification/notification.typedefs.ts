/**
 * @file notification.typedefs.ts
 * @module notification
 * @description Definición del esquema GraphQL para el módulo de notificaciones.
 *
 * Define el tipo `Notification` con sus campos. El campo `payload` almacena
 * datos adicionales serializados en JSON (como string) que el cliente puede
 * parsear para construir el mensaje apropiado según el tipo de notificación.
 *
 * El campo `readAt` es null cuando la notificación no ha sido leída;
 * tener este campo en lugar de un booleano permite saber cuándo fue leída.
 *
 * La suscripción `notificationAdded` permite recibir notificaciones
 * en tiempo real a través de WebSocket, filtradas por el usuario autenticado.
 */
export const notificationTypeDefs = `#graphql
  """
  Notificación interna del sistema destinada a un usuario específico.
  """
  type Notification {
    id: ID!
    """ ID del usuario destinatario. """
    userId: ID!
    """ Tipo de notificación (p.ej. STORY_ASSIGNED, SPRINT_STARTED). """
    type: String!
    """
    Datos adicionales en formato JSON string.
    El cliente debe parsear este campo para construir el mensaje.
    """
    payload: String
    """ Fecha en que el usuario leyó la notificación; null si no fue leída. """
    readAt: String
    createdAt: DateTime!
  }

  extend type Query {
    """ Retorna las notificaciones del usuario autenticado. """
    notifications(limit: Int): [Notification!]!
    """ Retorna el conteo de notificaciones no leídas (para el badge de la UI). """
    unreadNotificationCount: Int!
  }

  extend type Mutation {
    """ Marca una notificación específica como leída. """
    markNotificationRead(id: ID!): Notification!
    """ Marca todas las notificaciones del usuario como leídas. """
    markAllNotificationsRead: Boolean!
  }

  extend type Subscription {
    """ Emite una notificación en tiempo real cuando se crea para el usuario autenticado. """
    notificationAdded: Notification!
  }
`;
