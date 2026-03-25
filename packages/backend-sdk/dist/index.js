'use strict';
/**
 * packages/backend-sdk/dist/index.js — Universal shim (dev + prod)
 *
 * Resolution strategy:
 *   Production (node dist/main.js): ../../backend/dist/ exists → use compiled JS
 *   Development (tsx watch):        ../../backend/dist/ missing → fall back to ../../backend/src/ (tsx handles .ts)
 *
 * Paths are relative to this file's real location:
 *   /app/packages/backend-sdk/dist/index.js
 */

function load(distPath, srcPath) {
  try {
    return require(distPath);
  } catch {
    return require(srcPath);
  }
}

const auth      = load('../../backend/dist/middleware/auth.middleware',           '../../backend/src/middleware/auth.middleware');
const plan      = load('../../backend/dist/services/plan.service',                '../../backend/src/services/plan.service');
const reports   = load('../../backend/dist/modules/reports/reports.service',      '../../backend/src/modules/reports/reports.service');
const retro     = load('../../backend/dist/modules/retrospective/retro.service',  '../../backend/src/modules/retrospective/retro.service');
const pubsubMod = load('../../backend/dist/realtime/pubsub',                      '../../backend/src/realtime/pubsub');
const errors    = load('../../backend/dist/utils/error.utils',                    '../../backend/src/utils/error.utils');
const sanitize  = load('../../backend/dist/utils/sanitize.utils',                 '../../backend/src/utils/sanitize.utils');
const extTypes  = load('../../backend/dist/extensions/types',                     '../../backend/src/extensions/types');

Object.defineProperty(exports, '__esModule', { value: true });

// ─── Auth ─────────────────────────────────────────────────────────────────────
exports.requireAuth = auth.requireAuth;

// ─── Services ─────────────────────────────────────────────────────────────────
exports.PlanService    = plan.PlanService;
exports.ReportsService = reports.ReportsService;
exports.RetroService   = retro.RetroService;

// ─── Realtime ─────────────────────────────────────────────────────────────────
exports.pubsub                          = pubsubMod.pubsub;
exports.BOARD_UPDATED_CHANNEL           = pubsubMod.BOARD_UPDATED_CHANNEL;
exports.NOTIFICATION_ADDED_CHANNEL      = pubsubMod.NOTIFICATION_ADDED_CHANNEL;
exports.SPRINT_BURNDOWN_UPDATED_CHANNEL = pubsubMod.SPRINT_BURNDOWN_UPDATED_CHANNEL;
exports.POKER_SESSION_UPDATED_CHANNEL   = pubsubMod.POKER_SESSION_UPDATED_CHANNEL;
exports.RETRO_UPDATED_CHANNEL           = pubsubMod.RETRO_UPDATED_CHANNEL;

// ─── Errors ───────────────────────────────────────────────────────────────────
exports.AppError          = errors.AppError;
exports.NotFoundError     = errors.NotFoundError;
exports.UnauthorizedError = errors.UnauthorizedError;
exports.ForbiddenError    = errors.ForbiddenError;
exports.ValidationError   = errors.ValidationError;
exports.ConflictError     = errors.ConflictError;
exports.toGraphQLError    = errors.toGraphQLError;

// ─── Sanitize ─────────────────────────────────────────────────────────────────
exports.sanitizeString     = sanitize.sanitizeString;
exports.limitLength        = sanitize.limitLength;
exports.sanitizeWebhookUrl = sanitize.sanitizeWebhookUrl;

// ─── Extension types (EventType is a runtime enum) ────────────────────────────
exports.EventType = extTypes.EventType;
