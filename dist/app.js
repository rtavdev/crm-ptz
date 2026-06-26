"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const auth_1 = require("./routes/auth");
const users_1 = require("./routes/users");
const leads_1 = require("./routes/leads");
const deals_1 = require("./routes/deals");
const opportunities_1 = require("./routes/opportunities");
const events_1 = require("./routes/events");
const errorHandler_1 = require("./middleware/errorHandler");
const pool_1 = require("./config/pool");
const collectionRoute = '/api/:collection(leads|contacts|companies|deals|quotes|tasks|activities)';
const collectionItemRoute = `${collectionRoute}/:id`;
const collectionColumns = {
    leads: ['id', 'first_name', 'last_name', 'company', 'email', 'phone', 'source', 'notes', 'tenant_id', 'owner_id', 'created_at', 'created_by', 'modified_by'],
    contacts: ['id', 'first_name', 'last_name', 'company', 'email', 'phone', 'title', 'status', 'tenant_id', 'owner_id', 'created_at'],
    companies: ['id', 'name', 'industry', 'city', 'revenue', 'employees', 'website', 'tenant_id', 'owner_id', 'created_at'],
    deals: ['id', 'name', 'company', 'value', 'stage', 'owner', 'close_date', 'tenant_id', 'owner_id', 'created_at', 'created_by', 'modified_by'],
    quotes: ['id', 'number', 'customer', 'amount', 'status', 'tenant_id', 'owner_id', 'created_at'],
    tasks: ['id', 'title', 'related', 'due_date', 'priority', 'status', 'tenant_id', 'owner_id', 'created_at'],
    activities: ['id', 'type', 'title', 'meta', 'tenant_id', 'owner_id', 'created_at'],
};
const collectionNames = Object.keys(collectionColumns);
function getColumns(collection) {
    return collectionColumns[collection];
}
function buildUpsertSql(collection, columns) {
    const columnList = columns.map(column => `"${column}"`).join(', ');
    const valueList = columns.map((_, index) => `$${index + 1}`).join(', ');
    const updateList = columns
        .filter(column => column !== 'id')
        .map(column => `"${column}" = EXCLUDED."${column}"`)
        .join(', ');
    return `
    INSERT INTO "${collection}" (${columnList})
    VALUES (${valueList})
    ON CONFLICT (id) DO UPDATE SET ${updateList}
    RETURNING *
  `;
}
function buildSyncSelectSql(collection) {
    if (collection === 'tasks') {
        return `
      SELECT id, title, related, due_date AS "due_date", priority, status, tenant_id, owner_id, created_at
      FROM "tasks"
      ORDER BY created_at DESC NULLS LAST, id ASC
    `;
    }
    return `SELECT * FROM "${collection}" ORDER BY created_at DESC NULLS LAST, id ASC`;
}
function createApp() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use((req, res, next) => {
        const origin = req.headers.origin;
        if (origin) {
            res.header('Access-Control-Allow-Origin', origin);
            res.header('Access-Control-Allow-Credentials', 'true');
        }
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
        if (req.method === 'OPTIONS') {
            res.sendStatus(204);
            return;
        }
        next();
    });
    // 0. API ROUTES (must be mounted before the SPA catch-all)
    app.get('/api/sync', async (_req, res, next) => {
        try {
            const results = await Promise.all(collectionNames.map(collection => pool_1.pool.query(buildSyncSelectSql(collection))));
            res.json(collectionNames.reduce((payload, collection, index) => {
                payload[collection] = results[index]?.rows ?? [];
                return payload;
            }, {}));
        }
        catch (error) {
            next(error);
        }
    });
    app.post(collectionRoute, async (req, res, next) => {
        const collection = req.params.collection ?? '';
        const columns = getColumns(collection);
        if (!columns) {
            res.status(404).json({ error: 'Unknown collection' });
            return;
        }
        try {
            const body = (req.body ?? {});
            const record = {
                ...body,
                id: body.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
                created_at: body.created_at || new Date().toISOString(),
            };
            // Reuse the same acting-user source as owner assignment.
            // Note: this generic route does NOT run through authenticateJWT in
            // current code, so we can only populate audit fields if caller includes
            // them in the payload.
            //
            // For the dedicated leads/deals routers, audit fields are set from req.user.
            const values = columns.map((column) => {
                if (column === 'created_by' || column === 'modified_by') {
                    return body[column] ?? null;
                }
                return record[column] ?? null;
            });
            const result = await pool_1.pool.query(buildUpsertSql(collection, columns), values);
            res.status(200).json(result.rows[0]);
        }
        catch (error) {
            next(error);
        }
    });
    app.delete(collectionItemRoute, async (req, res, next) => {
        const collection = req.params.collection ?? '';
        if (!getColumns(collection)) {
            res.status(404).json({ error: 'Unknown collection' });
            return;
        }
        try {
            const result = await pool_1.pool.query(`DELETE FROM "${collection}" WHERE id = $1 RETURNING *`, [req.params.id]);
            if (!result.rowCount) {
                res.status(404).json({ error: 'Record not found' });
                return;
            }
            res.json({ deleted: true, record: result.rows[0] });
        }
        catch (error) {
            next(error);
        }
    });
    app.use('/api/auth', auth_1.authRouter);
    app.use('/api/users', users_1.usersRouter);
    app.use('/api/leads', leads_1.leadsRouter);
    app.use('/api/deals', deals_1.dealsRouter);
    app.use('/api/opportunities', opportunities_1.opportunitiesRouter);
    app.use('/api/events', events_1.eventsRouter);
    // 1. SERVE STATIC FILES: Points to your root-level public folder
    app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
    // 2. ERROR HANDLER (must be after all routes)
    app.use(errorHandler_1.errorHandler);
    // 3. FALLBACK CATCH-ALL
    app.get('*', (_req, res) => {
        res.sendFile(path_1.default.join(__dirname, '../public/index.html'));
    });
    return app;
}
//# sourceMappingURL=app.js.map