'use strict';
/**
 * packages/backend-sdk/dist/index.js — Production shim
 *
 * When premium extension packages (installed via npm) call
 * require('@scrumforge/backend-sdk'), this file is loaded inside the running
 * backend process. It re-exports from the compiled backend modules so
 * extensions get the same live instances (prisma, pubsub, etc.) as the core.
 *
 * Paths are relative to this file's real location:
 *   /app/packages/backend-sdk/dist/index.js
 *   →  ../../backend/dist/  =  /app/backend/dist/
 */

const auth        = require('../../backend/dist/middleware/auth.middleware');
const plan        = require('../../backend/dist/services/plan.service');
const reports     = require('../../backend/dist/modules/reports/reports.service');
const retro       = require('../../backend/dist/modules/retrospective/retro.service');
const pubsubMod   = require('../../backend/dist/realtime/pubsub');
const errors      = require('../../backend/dist/utils/error.utils');
const sanitize    = require('../../backend/dist/utils/sanitize.utils');
const extTypes    = require('../../backend/dist/extensions/types');

Object.defineProperty(exports, '__esModule', { value: true });

// ─── Auth ─────────────────────────────────────────────────────────────────────
exports.requireAuth = auth.requireAuth;

// ─── Services ─────────────────────────────────────────────────────────────────
exports.PlanService    = plan.PlanService;
exports.ReportsService = reports.ReportsService;
exports.RetroService   = retro.RetroService;

// ─── Realtime ─────────────────────────────────────────────────────────────────
exports.pubsub                        = pubsubMod.pubsub;
exports.BOARD_UPDATED_CHANNEL         = pubsubMod.BOARD_UPDATED_CHANNEL;
exports.NOTIFICATION_ADDED_CHANNEL    = pubsubMod.NOTIFICATION_ADDED_CHANNEL;
exports.SPRINT_BURNDOWN_UPDATED_CHANNEL = pubsubMod.SPRINT_BURNDOWN_UPDATED_CHANNEL;
exports.POKER_SESSION_UPDATED_CHANNEL = pubsubMod.POKER_SESSION_UPDATED_CHANNEL;
exports.RETRO_UPDATED_CHANNEL         = pubsubMod.RETRO_UPDATED_CHANNEL;

// ─── Errors ───────────────────────────────────────────────────────────────────
exports.AppError          = errors.AppError;
exports.NotFoundError     = errors.NotFoundError;
exports.UnauthorizedError = errors.UnauthorizedError;
exports.ForbiddenError    = errors.ForbiddenError;
exports.ValidationError   = errors.ValidationError;
exports.ConflictError     = errors.ConflictError;
exports.toGraphQLError    = errors.toGraphQLError;

// ─── Sanitize ─────────────────────────────────────────────────────────────────
exports.sanitizeString    = sanitize.sanitizeString;
exports.limitLength       = sanitize.limitLength;
exports.sanitizeWebhookUrl = sanitize.sanitizeWebhookUrl;

// ─── Extension types (EventType is a runtime enum) ────────────────────────────
exports.EventType = extTypes.EventType;
