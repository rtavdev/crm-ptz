import { Pool } from 'pg';
/**
 * Shared pg connection pool. The pool connects as the dedicated, non-superuser
 * application role so that PostgreSQL Row-Level Security policies are enforced
 * (superusers and BYPASSRLS roles ignore RLS).
 */
export declare const pool: Pool;
export declare function closePool(): Promise<void>;
