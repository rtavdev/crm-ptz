import type { NextFunction, Request, Response } from 'express';
/**
 * Neon Auth session verification via HTTP-only cookie.
 *
 * For Express routes, this middleware reads the session cookie and verifies
 * the session against the in-memory store. This is a simplified approach for
 * demo purposes — in production you'd use Neon's managed auth service.
 *
 * For Vercel serverless functions (api/*.ts), the session verification is
 * handled inline by extracting the user_id directly from the session cookie.
 */
declare global {
    var __neonSessions: Map<string, {
        userId: string;
        role: string;
        expiresAt: number;
    }> | undefined;
}
/** Get user_id from session cookie — used by Express middleware. */
/** Get user_id from session cookie — used by Express middleware. */
/** Get user_id from session cookie — used by Express middleware. */
export declare function getUserIdFromSession(req: Request): string | null;
/**
 * Extract and validate the session cookie, attaching the decoded principal
 * to `req.user`. Responds 401 when the session is missing or expired.
 */
export declare function authenticateJWT(req: Request, res: Response, next: NextFunction): void;
