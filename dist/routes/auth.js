"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const pool_1 = require("../config/pool");
const asyncHandler_1 = require("../middleware/asyncHandler");
const errorHandler_1 = require("../middleware/errorHandler");
const security_1 = require("../auth/security");
exports.authRouter = (0, express_1.Router)();
function asNonEmptyString(value, field) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new errorHandler_1.HttpError(400, `Field "${field}" is required`);
    }
    return value.trim();
}
/**
 * Bootstrap a new tenant. Creates the tenant row and its first user as an
 * ADMIN, then returns a signed JWT. Subsequent users are provisioned by an
 * authenticated ADMIN through the /api/users route.
 */
exports.authRouter.post('/register', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = req.body;
    const companyName = asNonEmptyString(body.companyName, 'companyName');
    const email = asNonEmptyString(body.email, 'email').toLowerCase();
    const password = asNonEmptyString(body.password, 'password');
    const passwordHash = await (0, security_1.hashPassword)(password);
    const client = await pool_1.pool.connect();
    try {
        await client.query('BEGIN');
        const existing = await client.query('SELECT 1 FROM users WHERE email = $1', [email]);
        if (existing.rowCount && existing.rowCount > 0) {
            throw new errorHandler_1.HttpError(409, 'Email already registered');
        }
        const tenantResult = await client.query('INSERT INTO tenants (company_name) VALUES ($1) RETURNING id', [companyName]);
        const tenantId = tenantResult.rows[0].id;
        const role = 'ADMIN';
        const userResult = await client.query(`INSERT INTO users (tenant_id, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, tenant_id, email, role, created_at`, [tenantId, email, passwordHash, role]);
        await client.query('COMMIT');
        const user = userResult.rows[0];
        const token = (0, security_1.signToken)({ userId: user.id, tenantId, role });
        res.status(201).json({ token, user: user });
    }
    catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
    }
    finally {
        client.release();
    }
}));
/** Authenticate by email + password and return a signed JWT on success. */
exports.authRouter.post('/login', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = req.body;
    const email = asNonEmptyString(body.email, 'email').toLowerCase();
    const password = asNonEmptyString(body.password, 'password');
    const result = await pool_1.pool.query(`SELECT id, tenant_id, email, password_hash, role, created_at
       FROM users WHERE email = $1`, [email]);
    const user = result.rows[0];
    // Generic message + hash comparison regardless of existence to avoid
    // leaking which emails are registered (and to limit timing differences).
    if (!user) {
        throw new errorHandler_1.HttpError(401, 'Invalid credentials');
    }
    const ok = await (0, security_1.verifyPassword)(password, user.password_hash);
    if (!ok) {
        throw new errorHandler_1.HttpError(401, 'Invalid credentials');
    }
    const token = (0, security_1.signToken)({
        userId: user.id,
        tenantId: user.tenant_id,
        role: user.role,
    });
    res.json({
        token,
        user: {
            id: user.id,
            tenant_id: user.tenant_id,
            email: user.email,
            role: user.role,
            created_at: user.created_at,
        },
    });
}));
//# sourceMappingURL=auth.js.map