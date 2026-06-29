"use strict";
// ============================================================================
// src/routes/events.ts
//
// RTAV Audio-Visual CRM — Events API
//
// Provides the two endpoints consumed by the frontend dashboard:
//   GET  /api/events  — list all events for the authenticated tenant
//   POST /api/events  — create a new AV event
//
// Security:
//   • All routes require a valid Bearer JWT (authenticateJWT).
//   • RBAC scope is injected (injectAccessScope): SALES_REP can only see/
//     create records they own; ADMIN/MANAGER see all tenant records.
//   • Row-Level Security on the `events` table enforces tenant isolation at
//     the database layer via executeTenantQuery.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventsRouter = void 0;
const express_1 = require("express");
const asyncHandler_1 = require("../middleware/asyncHandler");
const errorHandler_1 = require("../middleware/errorHandler");
const authenticate_1 = require("../middleware/authenticate");
const authorize_1 = require("../middleware/authorize");
const context_1 = require("../db/context");
exports.eventsRouter = (0, express_1.Router)();
// Apply auth + RBAC scope to every events route
exports.eventsRouter.use(authenticate_1.authenticateJWT, authorize_1.injectAccessScope);
// ---------------------------------------------------------------------------
// Shared column list returned by every query
// ---------------------------------------------------------------------------
const EVENT_COLS = `
  id, tenant_id, owner_id,
  project_title, client_name, venue,
  estimated_revenue, stage,
  event_date, notes,
  created_at, updated_at
`.trim();
// ---------------------------------------------------------------------------
// Valid AV pipeline stage values  (must match the av_stage enum in the DB)
// ---------------------------------------------------------------------------
const AV_STAGES = [
    'quotation_pitch',
    'site_survey',
    'confirmed_gear_reserved',
    'settled_show_wrap',
];
function isAvStage(value) {
    return typeof value === 'string' && AV_STAGES.includes(value);
}
// ---------------------------------------------------------------------------
// GET /api/events
//
// Returns all events for the authenticated tenant.
// SALES_REP scope is owner-filtered; ADMIN/MANAGER see everything.
//
// Response shape:
//   {
//     events: EventRow[],
//     meta: {
//       totalPipelineValue: number,   // sum of estimated_revenue for non-settled events
//       activeShows: number,          // count where stage = 'confirmed_gear_reserved'
//       totalEvents: number
//     }
//   }
// ---------------------------------------------------------------------------
exports.eventsRouter.get('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { tenantId, userId } = req.user;
    const scope = req.accessScope;
    const params = [];
    let whereClause = '';
    if (scope.restrictToOwner) {
        params.push(userId);
        whereClause = `WHERE owner_id = $${params.length}`;
    }
    const result = await (0, context_1.executeTenantQuery)(tenantId, `SELECT ${EVENT_COLS} FROM events ${whereClause} ORDER BY created_at DESC`, params);
    const events = result.rows;
    // Compute dashboard metrics from the returned rows
    const totalPipelineValue = events
        .filter((e) => e.stage !== 'settled_show_wrap')
        .reduce((sum, e) => sum + parseFloat(e.estimated_revenue), 0);
    const activeShows = events.filter((e) => e.stage === 'confirmed_gear_reserved').length;
    res.json({
        events,
        meta: {
            totalPipelineValue,
            activeShows,
            totalEvents: events.length,
        },
    });
}));
// ---------------------------------------------------------------------------
// POST /api/events
//
// Create a new AV event. Body fields:
//   project_title   (string, required)  — e.g. "Annual Corporate Summit 2026"
//   client_name     (string, required)  — e.g. "Meridian Financial Group"
//   venue           (string, optional)  — e.g. "Grand Hyatt Ballroom"
//   estimated_revenue (number, required) — total contract value in USD
//   stage           (string, optional)  — defaults to 'quotation_pitch'
//   event_date      (ISO date, optional)
//   notes           (string, optional)
//
// Response: { event: EventRow }
// ---------------------------------------------------------------------------
exports.eventsRouter.post('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { tenantId, userId } = req.user;
    const scope = req.accessScope;
    const body = req.body;
    // ── Validate required fields ───────────────────────────────────────────
    if (typeof body.project_title !== 'string' || body.project_title.trim().length === 0) {
        throw new errorHandler_1.HttpError(400, 'Field "project_title" is required');
    }
    if (typeof body.client_name !== 'string' || body.client_name.trim().length === 0) {
        throw new errorHandler_1.HttpError(400, 'Field "client_name" is required');
    }
    // ── Parse estimated_revenue ────────────────────────────────────────────
    let revenue;
    if (typeof body.estimated_revenue === 'number' && Number.isFinite(body.estimated_revenue)) {
        revenue = body.estimated_revenue;
    }
    else if (typeof body.estimated_revenue === 'string' &&
        body.estimated_revenue.trim() !== '' &&
        !Number.isNaN(Number(body.estimated_revenue))) {
        revenue = Number(body.estimated_revenue);
    }
    else {
        throw new errorHandler_1.HttpError(400, 'Field "estimated_revenue" must be a valid number');
    }
    // ── Parse stage ────────────────────────────────────────────────────────
    const stage = body.stage === undefined
        ? 'quotation_pitch'
        : isAvStage(body.stage)
            ? body.stage
            : (() => {
                throw new errorHandler_1.HttpError(400, `Invalid "stage". Allowed values: ${AV_STAGES.join(', ')}`);
            })();
    // ── Optional fields ────────────────────────────────────────────────────
    const venue = typeof body.venue === 'string' ? body.venue.trim() : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const eventDate = typeof body.event_date === 'string' && body.event_date.trim().length > 0
        ? body.event_date.trim()
        : null;
    // ── Owner assignment ───────────────────────────────────────────────────
    // SALES_REP is always the owner of their own records.
    // ADMIN/MANAGER may optionally assign to another user via owner_id.
    let ownerId = userId;
    if (!scope.restrictToOwner &&
        typeof body.owner_id === 'string' &&
        body.owner_id.length > 0) {
        ownerId = body.owner_id;
    }
    const result = await (0, context_1.executeTenantQuery)(tenantId, `INSERT INTO events
         (tenant_id, owner_id, project_title, client_name, venue,
          estimated_revenue, stage, event_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${EVENT_COLS}`, [
        tenantId,
        ownerId,
        body.project_title.trim(),
        body.client_name.trim(),
        venue,
        revenue.toString(),
        stage,
        eventDate,
        notes,
    ]);
    res.status(201).json({ event: result.rows[0] });
}));
//# sourceMappingURL=events.js.map