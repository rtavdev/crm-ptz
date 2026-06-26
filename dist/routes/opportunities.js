"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.opportunitiesRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const asyncHandler_1 = require("../middleware/asyncHandler");
const errorHandler_1 = require("../middleware/errorHandler");
const authenticate_1 = require("../middleware/authenticate");
const authorize_1 = require("../middleware/authorize");
const context_1 = require("../db/context");
const opportunityImport_1 = require("../import/opportunityImport");
exports.opportunitiesRouter = (0, express_1.Router)();
exports.opportunitiesRouter.use(authenticate_1.authenticateJWT, authorize_1.injectAccessScope);
const OPP_COLUMNS = 'id, tenant_id, owner_id, name, account_name, stage, estimated_revenue, created_at';
function requireNonEmptyString(value, field) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new errorHandler_1.HttpError(400, `Field "${field}" is required`);
    }
    return value.trim();
}
function parseRevenue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value.toString();
    }
    if (typeof value === 'string') {
        const cleaned = value.replace(/[$,\s]/g, '');
        if (cleaned !== '' && !Number.isNaN(Number(cleaned))) {
            return cleaned;
        }
    }
    throw new errorHandler_1.HttpError(400, 'Field "estimated_revenue" must be a valid number');
}
const ALLOWED_EXTENSIONS = ['.xlsx', '.csv'];
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
        const lower = file.originalname.toLowerCase();
        if (ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
            cb(null, true);
        }
        else {
            cb(new errorHandler_1.HttpError(400, 'Only .xlsx or .csv files are accepted'));
        }
    },
});
/** GET /api/opportunities — list opportunities, owner-scoped for SALES_REP. */
exports.opportunitiesRouter.get('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { tenantId, userId } = req.user;
    const scope = req.accessScope;
    let text = `SELECT ${OPP_COLUMNS} FROM opportunities`;
    const params = [];
    if (scope.restrictToOwner) {
        params.push(userId);
        text += ` WHERE owner_id = $${params.length}`;
    }
    text += ' ORDER BY created_at DESC';
    const result = await (0, context_1.executeTenantQuery)(tenantId, text, params);
    res.json({ opportunities: result.rows });
}));
/** GET /api/opportunities/:id — fetch one opportunity, owner-scoped for SALES_REP. */
exports.opportunitiesRouter.get('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { tenantId, userId } = req.user;
    const scope = req.accessScope;
    const params = [req.params.id];
    let text = `SELECT ${OPP_COLUMNS} FROM opportunities WHERE id = $1`;
    if (scope.restrictToOwner) {
        params.push(userId);
        text += ` AND owner_id = $${params.length}`;
    }
    const result = await (0, context_1.executeTenantQuery)(tenantId, text, params);
    const opportunity = result.rows[0];
    if (!opportunity) {
        throw new errorHandler_1.HttpError(404, 'Opportunity not found');
    }
    res.json({ opportunity });
}));
/** POST /api/opportunities — create a single opportunity. SALES_REP owns its own records. */
exports.opportunitiesRouter.post('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { tenantId, userId } = req.user;
    const scope = req.accessScope;
    const body = req.body;
    const name = requireNonEmptyString(body.name, 'name');
    const accountName = requireNonEmptyString(body.account_name, 'account_name');
    const stage = requireNonEmptyString(body.stage, 'stage');
    const revenue = parseRevenue(body.estimated_revenue);
    let ownerId = userId;
    if (!scope.restrictToOwner && typeof body.owner_id === 'string' && body.owner_id.length > 0) {
        ownerId = body.owner_id;
    }
    const result = await (0, context_1.executeTenantQuery)(tenantId, `INSERT INTO opportunities (tenant_id, owner_id, name, account_name, stage, estimated_revenue)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${OPP_COLUMNS}`, [tenantId, ownerId, name, accountName, stage, revenue]);
    res.status(201).json({ opportunity: result.rows[0] });
}));
/** PUT /api/opportunities/:id — update an opportunity, owner-scoped for SALES_REP. */
exports.opportunitiesRouter.put('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { tenantId, userId } = req.user;
    const scope = req.accessScope;
    const body = req.body;
    const sets = [];
    const params = [];
    const add = (col, value) => {
        params.push(value);
        sets.push(`${col} = $${params.length}`);
    };
    if (body.name !== undefined) {
        add('name', requireNonEmptyString(body.name, 'name'));
    }
    if (body.account_name !== undefined) {
        add('account_name', requireNonEmptyString(body.account_name, 'account_name'));
    }
    if (body.stage !== undefined) {
        add('stage', requireNonEmptyString(body.stage, 'stage'));
    }
    if (body.estimated_revenue !== undefined) {
        add('estimated_revenue', parseRevenue(body.estimated_revenue));
    }
    if (sets.length === 0) {
        throw new errorHandler_1.HttpError(400, 'No updatable fields provided');
    }
    params.push(req.params.id);
    let text = `UPDATE opportunities SET ${sets.join(', ')} WHERE id = $${params.length}`;
    if (scope.restrictToOwner) {
        params.push(userId);
        text += ` AND owner_id = $${params.length}`;
    }
    text += ` RETURNING ${OPP_COLUMNS}`;
    const result = await (0, context_1.executeTenantQuery)(tenantId, text, params);
    const opportunity = result.rows[0];
    if (!opportunity) {
        throw new errorHandler_1.HttpError(404, 'Opportunity not found');
    }
    res.json({ opportunity });
}));
/** DELETE /api/opportunities/:id — delete an opportunity, owner-scoped for SALES_REP. */
exports.opportunitiesRouter.delete('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { tenantId, userId } = req.user;
    const scope = req.accessScope;
    const params = [req.params.id];
    let text = 'DELETE FROM opportunities WHERE id = $1';
    if (scope.restrictToOwner) {
        params.push(userId);
        text += ` AND owner_id = $${params.length}`;
    }
    text += ' RETURNING id';
    const result = await (0, context_1.executeTenantQuery)(tenantId, text, params);
    if (result.rowCount === 0) {
        throw new errorHandler_1.HttpError(404, 'Opportunity not found');
    }
    res.status(204).send();
}));
/**
 * POST /api/opportunities/import — bulk import opportunities from an uploaded
 * .xlsx/.csv file.
 *
 * Flow: parse + validate every row; if ANY cell fails, abort and return a
 * targeted per-row/cell error report (nothing is written). Otherwise inject the
 * caller's tenant_id/owner_id from the JWT and perform a single set-based
 * `unnest` bulk insert inside `executeTenantQuery`, so the entire batch runs in
 * one RLS-scoped transaction (rolled back on any failure).
 */
exports.opportunitiesRouter.post('/import', upload.single('file'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { tenantId, userId } = req.user;
    if (!req.file) {
        throw new errorHandler_1.HttpError(400, 'Expected a file upload in the "file" field');
    }
    const { rows, errors } = (0, opportunityImport_1.parseOpportunityWorkbook)(req.file.buffer);
    if (errors.length > 0) {
        // Hard abort: do not insert anything. Report exactly which row/cell failed.
        res.status(422).json({
            error: 'Validation failed; no rows were imported',
            imported: 0,
            errors,
        });
        return;
    }
    // Inject the authenticated tenant/owner into every validated row, then
    // bulk-insert via unnest within the RLS transaction wrapper.
    const names = rows.map((r) => r.name);
    const accounts = rows.map((r) => r.account_name);
    const stages = rows.map((r) => r.stage);
    const revenues = rows.map((r) => r.estimated_revenue);
    const result = await (0, context_1.executeTenantQuery)(tenantId, `INSERT INTO opportunities (tenant_id, owner_id, name, account_name, stage, estimated_revenue)
       SELECT $1, $2, n, a, s, r
       FROM unnest($3::text[], $4::text[], $5::text[], $6::numeric[]) AS t(n, a, s, r)
       RETURNING id`, [tenantId, userId, names, accounts, stages, revenues]);
    res.status(201).json({
        imported: result.rowCount ?? result.rows.length,
        ids: result.rows.map((row) => row.id),
    });
}));
//# sourceMappingURL=opportunities.js.map