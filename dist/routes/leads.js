"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leadsRouter = void 0;
const express_1 = require("express");
const asyncHandler_1 = require("../middleware/asyncHandler");
const errorHandler_1 = require("../middleware/errorHandler");
const authenticate_1 = require("../middleware/authenticate");
const authorize_1 = require("../middleware/authorize");
const context_1 = require("../db/context");
const enums_1 = require("../domain/enums");
exports.leadsRouter = (0, express_1.Router)();
// Every leads endpoint requires a valid JWT and a computed access scope.
exports.leadsRouter.use(authenticate_1.authenticateJWT, authorize_1.injectAccessScope);
const LEAD_COLUMNS = [
    'id',
    'tenant_id',
    'owner_id',
    'first_name',
    'last_name',
    'status',
    'company',
    'email',
    'phone',
    'source',
    'notes',
    'created_at',
].join(', ');
function isLeadStatus(value) {
    return typeof value === 'string' && enums_1.LEAD_STATUSES.includes(value);
}
function optionalText(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
/**
 * GET /api/leads — list leads in the tenant. RLS already restricts rows to the
 * caller's tenant; SALES_REP scope additionally appends `WHERE owner_id = $1`.
 */
exports.leadsRouter.get('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { tenantId, userId } = req.user;
    const scope = req.accessScope;
    let text = `SELECT ${LEAD_COLUMNS} FROM leads`;
    const params = [];
    if (scope.restrictToOwner) {
        params.push(userId);
        text += ` WHERE owner_id = $${params.length}`;
    }
    text += ' ORDER BY created_at DESC';
    const result = await (0, context_1.executeTenantQuery)(tenantId, text, params);
    res.json({ leads: result.rows, data: result.rows, items: result.rows });
}));
/** GET /api/leads/:id — fetch one lead, owner-scoped for SALES_REP. */
exports.leadsRouter.get('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { tenantId, userId } = req.user;
    const scope = req.accessScope;
    const params = [req.params.id];
    let text = `SELECT ${LEAD_COLUMNS} FROM leads WHERE id = $1`;
    if (scope.restrictToOwner) {
        params.push(userId);
        text += ` AND owner_id = $${params.length}`;
    }
    const result = await (0, context_1.executeTenantQuery)(tenantId, text, params);
    const lead = result.rows[0];
    if (!lead) {
        throw new errorHandler_1.HttpError(404, 'Lead not found');
    }
    res.json({ lead });
}));
/** POST /api/leads — create a lead. SALES_REP can only create leads they own. */
exports.leadsRouter.post('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { tenantId, userId } = req.user;
    const scope = req.accessScope;
    const body = req.body;
    if (typeof body.first_name !== 'string' || body.first_name.trim().length === 0) {
        throw new errorHandler_1.HttpError(400, 'Field "first_name" is required');
    }
    if (typeof body.last_name !== 'string' || body.last_name.trim().length === 0) {
        throw new errorHandler_1.HttpError(400, 'Field "last_name" is required');
    }
    const status = body.status === undefined ? 'NEW' : (isLeadStatus(body.status)
        ? body.status
        : (() => {
            throw new errorHandler_1.HttpError(400, `Invalid "status"; allowed: ${enums_1.LEAD_STATUSES.join(', ')}`);
        })());
    // Owner assignment: privileged roles may assign to any user in the tenant;
    // a SALES_REP is always forced to own its own records.
    let ownerId = userId;
    if (!scope.restrictToOwner && typeof body.owner_id === 'string' && body.owner_id.length > 0) {
        ownerId = body.owner_id;
    }
    const result = await (0, context_1.executeTenantQuery)(tenantId, `INSERT INTO leads (
         tenant_id, owner_id, first_name, last_name, status,
         company, email, phone, source, notes,
         created_by, modified_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING ${LEAD_COLUMNS}`, [
        tenantId,
        ownerId,
        body.first_name.trim(),
        body.last_name.trim(),
        status,
        optionalText(body.company),
        optionalText(body.email),
        optionalText(body.phone),
        optionalText(body.source),
        optionalText(body.notes),
        userId,
        userId,
    ]);
    const lead = result.rows[0];
    res.status(201).json({ ...lead, lead, data: lead, item: lead });
}));
/** PUT /api/leads/:id — update a lead, owner-scoped for SALES_REP. */
exports.leadsRouter.put('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { tenantId, userId } = req.user;
    const scope = req.accessScope;
    const body = req.body;
    const sets = [];
    const params = [];
    const add = (col, value) => {
        params.push(value);
        sets.push(`${col} = $${params.length}`);
    };
    if (body.first_name !== undefined) {
        if (typeof body.first_name !== 'string' || body.first_name.trim().length === 0) {
            throw new errorHandler_1.HttpError(400, 'Field "first_name" must be a non-empty string');
        }
        add('first_name', body.first_name.trim());
    }
    if (body.last_name !== undefined) {
        if (typeof body.last_name !== 'string' || body.last_name.trim().length === 0) {
            throw new errorHandler_1.HttpError(400, 'Field "last_name" must be a non-empty string');
        }
        add('last_name', body.last_name.trim());
    }
    if (body.status !== undefined) {
        if (!isLeadStatus(body.status)) {
            throw new errorHandler_1.HttpError(400, `Invalid "status"; allowed: ${enums_1.LEAD_STATUSES.join(', ')}`);
        }
        add('status', body.status);
    }
    if (body.company !== undefined) {
        add('company', optionalText(body.company));
    }
    if (body.email !== undefined) {
        add('email', optionalText(body.email));
    }
    if (body.phone !== undefined) {
        add('phone', optionalText(body.phone));
    }
    if (body.source !== undefined) {
        add('source', optionalText(body.source));
    }
    if (body.notes !== undefined) {
        add('notes', optionalText(body.notes));
    }
    // Always stamp modification actor.
    add('modified_by', userId);
    if (sets.length === 0) {
        throw new errorHandler_1.HttpError(400, 'No updatable fields provided');
    }
    params.push(req.params.id);
    let text = `UPDATE leads SET ${sets.join(', ')} WHERE id = $${params.length}`;
    if (scope.restrictToOwner) {
        params.push(userId);
        text += ` AND owner_id = $${params.length}`;
    }
    text += ` RETURNING ${LEAD_COLUMNS}`;
    const result = await (0, context_1.executeTenantQuery)(tenantId, text, params);
    const lead = result.rows[0];
    if (!lead) {
        throw new errorHandler_1.HttpError(404, 'Lead not found');
    }
    res.json({ lead });
}));
/** DELETE /api/leads/:id — delete a lead, owner-scoped for SALES_REP. */
exports.leadsRouter.delete('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { tenantId, userId } = req.user;
    const scope = req.accessScope;
    const params = [req.params.id];
    let text = 'DELETE FROM leads WHERE id = $1';
    if (scope.restrictToOwner) {
        params.push(userId);
        text += ` AND owner_id = $${params.length}`;
    }
    text += ' RETURNING id';
    const result = await (0, context_1.executeTenantQuery)(tenantId, text, params);
    if (result.rowCount === 0) {
        throw new errorHandler_1.HttpError(404, 'Lead not found');
    }
    res.status(204).send();
}));
//# sourceMappingURL=leads.js.map