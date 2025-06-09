/**
 * notification.socket.ts
 *
 * Notification push helpers built on top of the graphql-ws PubSub instance.
 * These helpers allow any service or event handler to push a notification
 * to a specific user's subscription channel without importing pubsub directly.
 */

import { pubsub, NOTIFICATION_ADDED_CHANNEL } from './pubsub';
import type { Notification } from '@prisma/client';

/**
 * Pushes a new notification to the target user's subscription.
 * Called from notification.handler.ts after inserting the DB record.
 */
export async function publishNotificationAdded(
  userId: string,
  notification: Notification,
): Promise<void> {
  await pubsub.publish(NOTIFICATION_ADDED_CHANNEL(userId), {
    notificationAdded: notification,
  });
}
