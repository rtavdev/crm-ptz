"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dealsRouter = void 0;
const express_1 = require("express");
const asyncHandler_1 = require("../middleware/asyncHandler");
const errorHandler_1 = require("../middleware/errorHandler");
const authenticate_1 = require("../middleware/authenticate");
const authorize_1 = require("../middleware/authorize");
const context_1 = require("../db/context");
const enums_1 = require("../domain/enums");
exports.dealsRouter = (0, express_1.Router)();
exports.dealsRouter.use(authenticate_1.authenticateJWT, authorize_1.injectAccessScope);
const DEAL_COLUMNS = [
    'id',
    'tenant_id',
    'lead_id',
    'owner_id',
    'amount',
    'stage',
    'name',
    'company',
    'value',
    'close_date',
    'owner',
    'notes',
    'created_at',
].join(', ');
function isDealStage(value) {
    return typeof value === 'string' && enums_1.DEAL_STAGES.includes(value);
}
function normalizeDealStage(value) {
    if (value === undefined) {
        return undefined;
    }
    if (isDealStage(value)) {
        return value;
    }
    if (typeof value !== 'string') {
        return undefined;
    }
    const stageMap = {
        'new deals': 'PROSPECTING',
        prospect: 'PROSPECTING',
        prospecting: 'PROSPECTING',
        proposal: 'PROPOSAL',
        negotiation: 'NEGOTIATION',
        won: 'CLOSED_WON',
        lost: 'CLOSED_LOST',
        closed_won: 'CLOSED_WON',
        closed_lost: 'CLOSED_LOST',
    };
    return stageMap[value.trim().toLowerCase()];
}
function toWebStage(stage) {
    switch (stage) {
        case 'PROSPECTING':
            return 'new deals';
        case 'PROPOSAL':
            return 'proposal';
        case 'NEGOTIATION':
            return 'negotiation';
        case 'CLOSED_WON':
            return 'won';
        case 'CLOSED_LOST':
            return 'lost';
        default: {
            const _exhaustive = stage;
            return _exhaustive;
        }
    }
}
function toWebDeal(deal) {
    return {
        ...deal,
        stage: toWebStage(deal.stage),
        value: deal.value ?? deal.amount,
    };
}
function optionalText(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
function optionalDate(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
function parseAmount(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value.toString();
    }
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
        return value.trim();
    }
    throw new errorHandler_1.HttpError(400, 'Field "amount" must be a valid number');
}
/** GET /api/deals — list deals, owner-scoped for SALES_REP. */
exports.dealsRouter.get('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { tenantId, userId } = req.user;
    const scope = req.accessScope;
    let text = `SELECT ${DEAL_COLUMNS} FROM deals`;
    const params = [];
    if (scope.restrictToOwner) {
        params.push(userId);
        text += ` WHERE owner_id = $${params.length}`;
    }
    text += ' ORDER BY created_at DESC';
    const result = await (0, context_1.executeTenantQuery)(tenantId, text, params);
    const data = result.rows.map(toWebDeal);
    res.json({ deals: result.rows, data, items: data });
}));
/** GET /api/deals/:id — fetch one deal, owner-scoped for SALES_REP. */
exports.dealsRouter.get('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { tenantId, userId } = req.user;
    const scope = req.accessScope;
    const params = [req.params.id];
    let text = `SELECT ${DEAL_COLUMNS} FROM deals WHERE id = $1`;
    if (scope.restrictToOwner) {
        params.push(userId);
        text += ` AND owner_id = $${params.length}`;
    }
    const result = await (0, context_1.executeTenantQuery)(tenantId, text, params);
    const deal = result.rows[0];
    if (!deal) {
        throw new errorHandler_1.HttpError(404, 'Deal not found');
    }
    res.json({ deal });
}));
/** POST /api/deals — create a deal. SALES_REP can only create deals they own. */
exports.dealsRouter.post('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { tenantId, userId } = req.user;
    const scope = req.accessScope;
    const body = req.body;
    const leadId = optionalText(body.lead_id);
    const amount = parseAmount(body.amount ?? body.value ?? 0);
    const normalizedStage = normalizeDealStage(body.stage);
    if (body.stage !== undefined && normalizedStage === undefined) {
        throw new errorHandler_1.HttpError(400, `Invalid "stage"; allowed: ${enums_1.DEAL_STAGES.join(', ')}`);
    }
    const stage = normalizedStage ?? 'PROSPECTING';
    let ownerId = userId;
    if (!scope.restrictToOwner && typeof body.owner_id === 'string' && body.owner_id.length > 0) {
        ownerId = body.owner_id;
    }
    const result = await (0, context_1.executeTenantQuery)(tenantId, `INSERT INTO deals (
         tenant_id, lead_id, owner_id, amount, stage,
         name, company, value, close_date, owner, notes
       )
         name, company, value, close_date, owner, notes,
         created_by, modified_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING ${DEAL_COLUMNS}`, [
        tenantId,
        leadId,
        ownerId,
        amount,
        stage,
        optionalText(body.name),
        optionalText(body.company),
        amount,
        optionalDate(body.close_date),
        optionalText(body.owner),
        optionalText(body.notes),
        userId,
        userId,
    ]);
    const deal = result.rows[0];
    const data = toWebDeal(deal);
    res.status(201).json({ ...data, deal, data, item: data });
}));
/** PUT /api/deals/:id — update a deal, owner-scoped for SALES_REP. */
exports.dealsRouter.put('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { tenantId, userId } = req.user;
    const scope = req.accessScope;
    const body = req.body;
    const sets = [];
    const params = [];
    const add = (col, value) => {
        params.push(value);
        sets.push(`${col} = $${params.length}`);
    };
    if (body.amount !== undefined) {
        add('amount', parseAmount(body.amount));
    }
    if (body.value !== undefined) {
        const value = parseAmount(body.value);
        add('value', value);
        if (body.amount === undefined) {
            add('amount', value);
        }
    }
    if (body.stage !== undefined) {
        const normalizedStage = normalizeDealStage(body.stage);
        if (normalizedStage === undefined) {
            throw new errorHandler_1.HttpError(400, `Invalid "stage"; allowed: ${enums_1.DEAL_STAGES.join(', ')}`);
        }
        add('stage', normalizedStage);
    }
    if (body.lead_id !== undefined) {
        add('lead_id', optionalText(body.lead_id));
    }
    if (body.name !== undefined) {
        add('name', optionalText(body.name));
    }
    if (body.company !== undefined) {
        add('company', optionalText(body.company));
    }
    if (body.close_date !== undefined) {
        add('close_date', optionalDate(body.close_date));
    }
    if (body.owner !== undefined) {
        add('owner', optionalText(body.owner));
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
    let text = `UPDATE deals SET ${sets.join(', ')} WHERE id = $${params.length}`;
    if (scope.restrictToOwner) {
        params.push(userId);
        text += ` AND owner_id = $${params.length}`;
    }
    text += ` RETURNING ${DEAL_COLUMNS}`;
    const result = await (0, context_1.executeTenantQuery)(tenantId, text, params);
    const deal = result.rows[0];
    if (!deal) {
        throw new errorHandler_1.HttpError(404, 'Deal not found');
    }
    res.json({ deal });
}));
/** DELETE /api/deals/:id — delete a deal, owner-scoped for SALES_REP. */
exports.dealsRouter.delete('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { tenantId, userId } = req.user;
    const scope = req.accessScope;
    const params = [req.params.id];
    let text = 'DELETE FROM deals WHERE id = $1';
    if (scope.restrictToOwner) {
        params.push(userId);
        text += ` AND owner_id = $${params.length}`;
    }
    text += ' RETURNING id';
    const result = await (0, context_1.executeTenantQuery)(tenantId, text, params);
    if (result.rowCount === 0) {
        throw new errorHandler_1.HttpError(404, 'Deal not found');
    }
    res.status(204).send();
}));
//# sourceMappingURL=deals.js.map