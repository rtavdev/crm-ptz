"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeTenantQuery = executeTenantQuery;
exports.withTenantTransaction = withTenantTransaction;
const pool_1 = require("../config/pool");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * Execute a query inside a tenant-scoped transaction.
 *
 * Every tenant-scoped data access MUST go through this wrapper. It:
 *   1. acquires a client from the pool,
 *   2. opens a transaction (BEGIN),
 *   3. binds the transaction-local `app.current_tenant_id` GUC that the RLS
 *      policies read,
 *   4. runs the supplied query,
 *   5. commits and releases the client,
 *   6. rolls back and releases on any failure.
 *
 * The tenant id is applied with `set_config(..., is_local => true)`, which is
 * the parameterized, injection-safe equivalent of
 * `SET LOCAL app.current_tenant_id = <tenant_id>`. `SET LOCAL` does not accept
 * bind parameters, so set_config is used to avoid string interpolation.
 */
async function executeTenantQuery(tenantId, text, params = []) {
    if (!UUID_RE.test(tenantId)) {
        throw new Error('executeTenantQuery: tenantId must be a valid UUID');
    }
    const client = await pool_1.pool.connect();
    try {
        await client.query('BEGIN');
        // Transaction-local: automatically discarded on COMMIT/ROLLBACK, so the
        // setting can never leak to another request reusing this pooled client.
        await client.query('SELECT set_config($1, $2, true)', [
            'app.current_tenant_id',
            tenantId,
        ]);
        const result = await client.query(text, params);
        await client.query('COMMIT');
        return result;
    }
    catch (err) {
        try {
            await client.query('ROLLBACK');
        }
        catch {
            // Ignore rollback errors; surface the original failure below.
        }
        throw err;
    }
    finally {
        client.release();
    }
}
/**
 * Run multiple statements within a single tenant-scoped transaction. The
 * callback receives a client whose `app.current_tenant_id` is already bound;
 * the transaction commits if the callback resolves and rolls back if it throws.
 */
async function withTenantTransaction(tenantId, fn) {
    if (!UUID_RE.test(tenantId)) {
        throw new Error('withTenantTransaction: tenantId must be a valid UUID');
    }
    const client = await pool_1.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT set_config($1, $2, true)', [
            'app.current_tenant_id',
            tenantId,
        ]);
        const out = await fn(client);
        await client.query('COMMIT');
        return out;
    }
    catch (err) {
        try {
            await client.query('ROLLBACK');
        }
        catch {
            // Ignore rollback errors; surface the original failure below.
        }
        throw err;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=context.js.map