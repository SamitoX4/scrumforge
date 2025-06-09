/**
 * @file notification.resolver.ts
 * @module notification
 * @description Resolvers de GraphQL para el módulo de notificaciones.
 *
 * A diferencia de otros módulos, el repositorio y el servicio se instancian
 * una sola vez a nivel de módulo (singletons), ya que usan el cliente Prisma
 * global (`prisma`) y no el del contexto de request. Esto mejora el rendimiento
 * al evitar instanciar objetos en cada resolver.
 *
 * Incluye:
 * - Queries para listar notificaciones y contar no leídas.
 * - Mutations para marcar como leída una o todas las notificaciones.
 * - Subscription para recibir notificaciones en tiempo real via PubSub/WebSocket.
 */

import { prisma } from '../../config/db/prisma.client';
import { GraphQLContext } from '../../graphql/context';
import { requireAuth } from '../../middleware/auth.middleware';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';
import { pubsub, NOTIFICATION_ADDED_CHANNEL } from '../../realtime/pubsub';

// Singleton: se instancian una vez al cargar el módulo, no por request
const repo = new NotificationRepository(prisma);
const service = new NotificationService(repo);

/**
 * Mapa de resolvers para el módulo de notificaciones.
 * Incluye Query, Mutation y Subscription.
 */
export const notificationResolvers = {
  Query: {
    /**
     * Retorna las notificaciones del usuario autenticado.
     * El límite por defecto es 30 notificaciones; se puede ajustar.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param args - Argumentos: `limit` opcional.
     * @param context - Contexto GraphQL con usuario autenticado.
     * @returns Lista de notificaciones del usuario.
     */
    notifications: async (
      _: unknown,
      args: { limit?: number },
      context: GraphQLContext,
    ) => {
      requireAuth(context);
      return service.getNotifications(context.user.id, args.limit ?? 30);
    },

    /**
     * Retorna el número de notificaciones no leídas del usuario autenticado.
     * Se usa para mostrar el badge de conteo en el ícono de notificaciones.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param __ - Argumentos; no hay ninguno.
     * @param context - Contexto GraphQL con usuario autenticado.
     * @returns Conteo de notificaciones sin leer.
     */
    unreadNotificationCount: async (
      _: unknown,
      __: unknown,
      context: GraphQLContext,
    ) => {
      requireAuth(context);
      return service.getUnreadCount(context.user.id);
    },
  },

  Mutation: {
    /**
     * Marca una notificación específica como leída.
     * Verifica que la notificación pertenezca al usuario autenticado
     * antes de actualizarla.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param args - Argumentos: `id` de la notificación.
     * @param context - Contexto GraphQL con usuario autenticado.
     * @returns La notificación actualizada con `readAt` asignado.
     */
    markNotificationRead: async (
      _: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => {
      requireAuth(context);
      return service.markRead(context.user.id, args.id);
    },

    /**
     * Marca todas las notificaciones del usuario autenticado como leídas.
     * Operación masiva útil para limpiar el panel de notificaciones.
     *
     * @param _ - Parent resolver; no utilizado.
     * @param __ - Argumentos; no hay ninguno.
     * @param context - Contexto GraphQL con usuario autenticado.
     * @returns `true` siempre que la operación sea exitosa.
     */
    markAllNotificationsRead: async (
      _: unknown,
      __: unknown,
      context: GraphQLContext,
    ) => {
      requireAuth(context);
      return service.markAllRead(context.user.id);
    },
  },

  Subscription: {
    /**
     * Suscripción en tiempo real que emite eventos cuando se crea
     * una nueva notificación para el usuario autenticado.
     *
     * El canal de PubSub es específico por usuario: `NOTIFICATION_ADDED_CHANNEL(userId)`
     * para que solo el destinatario reciba el evento.
     */
    notificationAdded: {
      /**
       * Función de suscripción al canal PubSub del usuario.
       *
       * @param _ - Parent resolver; no utilizado.
       * @param __ - Argumentos; no hay ninguno.
       * @param context - Contexto GraphQL con usuario autenticado.
       * @returns AsyncIterator que emite notificaciones del usuario.
       */
      subscribe: (_: unknown, __: unknown, context: GraphQLContext) => {
        requireAuth(context);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // El canal es único por usuario para evitar filtrar en el cliente
        return pubsub.asyncIterableIterator([NOTIFICATION_ADDED_CHANNEL(context.user.id)]) as AsyncIterator<any>;
      },
    },
  },
};
