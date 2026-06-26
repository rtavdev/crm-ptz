"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const pool_1 = require("../config/pool");
const asyncHandler_1 = require("../middleware/asyncHandler");
const errorHandler_1 = require("../middleware/errorHandler");
const authenticate_1 = require("../middleware/authenticate");
const authorize_1 = require("../middleware/authorize");
const security_1 = require("../auth/security");
const types_1 = require("../types");
exports.usersRouter = (0, express_1.Router)();
exports.usersRouter.use(authenticate_1.authenticateJWT);
function isRole(value) {
    return typeof value === 'string' && types_1.ROLES.includes(value);
}
/** List users in the caller's tenant. ADMIN and MANAGER only. */
exports.usersRouter.get('/', (0, authorize_1.requireRole)('ADMIN', 'MANAGER'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const tenantId = req.user.tenantId;
    const result = await pool_1.pool.query(`SELECT id, tenant_id, email, role, created_at
       FROM users WHERE tenant_id = $1 ORDER BY created_at`, [tenantId]);
    res.json({ users: result.rows });
}));
/** Provision a new user within the caller's tenant. ADMIN only. */
exports.usersRouter.post('/', (0, authorize_1.requireRole)('ADMIN'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const tenantId = req.user.tenantId;
    const body = req.body;
    if (typeof body.email !== 'string' || body.email.trim().length === 0) {
        throw new errorHandler_1.HttpError(400, 'Field "email" is required');
    }
    if (typeof body.password !== 'string' || body.password.length === 0) {
        throw new errorHandler_1.HttpError(400, 'Field "password" is required');
    }
    if (!isRole(body.role)) {
        throw new errorHandler_1.HttpError(400, `Field "role" must be one of: ${types_1.ROLES.join(', ')}`);
    }
    const email = body.email.trim().toLowerCase();
    const passwordHash = await (0, security_1.hashPassword)(body.password);
    try {
        const result = await pool_1.pool.query(`INSERT INTO users (tenant_id, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, tenant_id, email, role, created_at`, [tenantId, email, passwordHash, body.role]);
        res.status(201).json({ user: result.rows[0] });
    }
    catch (err) {
        if (typeof err === 'object' && err !== null && err.code === '23505') {
            throw new errorHandler_1.HttpError(409, 'Email already registered');
        }
        throw err;
    }
}));
//# sourceMappingURL=users.js.map