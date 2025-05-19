import { PubSub } from 'graphql-subscriptions';

/** Singleton PubSub — in-memory para subscripciones GraphQL. */
export const pubsub = new PubSub();

// ── Channel name helpers ──────────────────────────────────────────────────────

/** Canal para actualizaciones del tablero de un proyecto específico. */
export const BOARD_UPDATED_CHANNEL = (projectId: string) => `BOARD_UPDATED_${projectId}`;

/** Canal para nuevas notificaciones de un usuario específico. */
export const NOTIFICATION_ADDED_CHANNEL = (userId: string) => `NOTIFICATION_ADDED_${userId}`;

/** Canal para actualizaciones del burndown de un sprint específico. */
export const SPRINT_BURNDOWN_UPDATED_CHANNEL = (sprintId: string) => `SPRINT_BURNDOWN_UPDATED_${sprintId}`;

/** Canal para actualizaciones de una sesión de Planning Poker. */
export const POKER_SESSION_UPDATED_CHANNEL = (sessionId: string) => `POKER_SESSION_UPDATED_${sessionId}`;

/** Canal para actualizaciones en tiempo real de una retrospectiva. */
export const RETRO_UPDATED_CHANNEL = (retroId: string) => `RETRO_UPDATED_${retroId}`;
