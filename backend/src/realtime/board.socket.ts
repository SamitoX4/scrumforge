/**
 * board.socket.ts
 *
 * Board real-time helpers built on top of the graphql-ws PubSub instance.
 * The WebSocket server is initialised in main.ts (useServer from graphql-ws).
 * These helpers centralise the event publishing logic so resolvers stay thin.
 */

import { pubsub, BOARD_UPDATED_CHANNEL } from './pubsub';
import type { UserStory } from '@prisma/client';

/**
 * Publishes a board update event.
 * Called from user-story.resolver whenever a story status changes.
 */
export async function publishBoardUpdated(
  projectId: string,
  story: UserStory,
): Promise<void> {
  await pubsub.publish(BOARD_UPDATED_CHANNEL(projectId), { boardUpdated: story });
}
