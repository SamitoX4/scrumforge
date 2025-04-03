/**
 * @scrumforge/sdk — Backend public surface for premium extensions.
 *
 * Extensions import from '@scrumforge/sdk' instead of '../../...' so they
 * can be built as standalone npm packages.
 *
 * Resolution strategy:
 *   - Dev (tsx):  tsconfig paths → packages/backend-sdk/src/index.ts (tsx on the fly)
 *   - Prod (node dist/): file: local package → dist/backend-sdk/index.js (compiled by tsc)
 *
 * Add exports here only when a premium extension needs them.
 */

// ─── GraphQL context & auth ───────────────────────────────────────────────────
export type { GraphQLContext, AuthUser } from '../../../backend/src/graphql/context';
export { requireAuth } from '../../../backend/src/middleware/auth.middleware';

// ─── Services ─────────────────────────────────────────────────────────────────
export { PlanService } from '../../../backend/src/services/plan.service';
export { ReportsService } from '../../../backend/src/modules/reports/reports.service';
export { RetroService } from '../../../backend/src/modules/retrospective/retro.service';

// ─── Realtime ─────────────────────────────────────────────────────────────────
export {
  pubsub,
  BOARD_UPDATED_CHANNEL,
  NOTIFICATION_ADDED_CHANNEL,
  SPRINT_BURNDOWN_UPDATED_CHANNEL,
  POKER_SESSION_UPDATED_CHANNEL,
  RETRO_UPDATED_CHANNEL,
} from '../../../backend/src/realtime/pubsub';

// ─── Errors ───────────────────────────────────────────────────────────────────
export {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  toGraphQLError,
} from '../../../backend/src/utils/error.utils';

// ─── Sanitize ─────────────────────────────────────────────────────────────────
export { sanitizeString, limitLength, sanitizeWebhookUrl } from '../../../backend/src/utils/sanitize.utils';

// ─── Extension registry types ─────────────────────────────────────────────────
export type { ScrumForgeExtension, ExtensionInitContext } from '../../../backend/src/extensions/extension-registry';
export type { EventBus } from '../../../backend/src/extensions/types';
export { EventType } from '../../../backend/src/extensions/types';
