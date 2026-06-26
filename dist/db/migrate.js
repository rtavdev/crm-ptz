"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/**
 * Apply every SQL file in /migrations in lexical order.
 *
 * Migrations create the `crm_app` role, tables, RLS policies and grants, so
 * they must run as a superuser/owner — NOT as the restricted application role.
 * Provide that connection via MIGRATION_DATABASE_URL (falls back to
 * DATABASE_URL for simple local setups where they are the same).
 */
async function main() {
    const connectionString = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('Set MIGRATION_DATABASE_URL or DATABASE_URL to run migrations');
    }
    const migrationsDir = (0, node_path_1.join)(__dirname, '..', '..', 'migrations');
    const files = (0, node_fs_1.readdirSync)(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();
    const client = new pg_1.Client({ connectionString });
    await client.connect();
    try {
        for (const file of files) {
            const sql = (0, node_fs_1.readFileSync)((0, node_path_1.join)(migrationsDir, file), 'utf8');
            // eslint-disable-next-line no-console
            console.log(`Applying migration: ${file}`);
            await client.query(sql);
        }
        // eslint-disable-next-line no-console
        console.log(`Applied ${files.length} migration(s).`);
    }
    finally {
        await client.end();
    }
}
main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Migration failed:', err);
    process.exit(1);
});
//# sourceMappingURL=migrate.js.map