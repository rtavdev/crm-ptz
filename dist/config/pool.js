"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.closePool = closePool;
const pg_1 = require("pg");
const env_1 = require("./env");
/**
 * Shared pg connection pool. The pool connects as the dedicated, non-superuser
 * application role so that PostgreSQL Row-Level Security policies are enforced
 * (superusers and BYPASSRLS roles ignore RLS).
 */
exports.pool = new pg_1.Pool({
    connectionString: env_1.config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
});
exports.pool.on('error', (err) => {
    // A pooled client may emit an error while idle; log so it is not swallowed.
    // eslint-disable-next-line no-console
    console.error('Unexpected error on idle pg client', err);
});
async function closePool() {
    await exports.pool.end();
}
//# sourceMappingURL=pool.js.map