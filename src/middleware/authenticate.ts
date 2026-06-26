import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/env';

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

// In-memory session store mirroring the one in api/auth/[...route].ts
// In production, this would be a database or Redis store.
declare global {
  var __neonSessions: Map<string, { userId: string; role: string; expiresAt: number }> | undefined;
}
if (!global.__neonSessions) {
  global.__neonSessions = new Map();
}
const sessions = global.__neonSessions;

/** Extract the session ID from the request's cookie header. */
function getSessionId(req: Request): string | null {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/neon_auth_session=([^;]+)/);
  return match?.[1] ?? null;
}

/** Get user_id from session cookie — used by Express middleware. */
/** Get user_id from session cookie — used by Express middleware. */
/** Get user_id from session cookie — used by Express middleware. */
export function getUserIdFromSession(req: Request): string | null {
  const sessionId = getSessionId(req);
  if (!sessionId) return null;
  
  const session = sessions.get(sessionId);
  if (!session || Date.now() > session.expiresAt) {
    if (session) sessions.delete(sessionId);
    return null;
  }
  
  // Explicitly check for undefined and return null if found
  const userId = session.userId;
  return typeof userId === 'string' ? userId : null;
}
/**
 * Extract and validate the session cookie, attaching the decoded principal
 * to `req.user`. Responds 401 when the session is missing or expired.
 */
export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.header('x-api-key');
  if (apiKey !== undefined && apiKey === config.systemApiSecretKey) {
    req.user = {
      userId: config.demoOwnerId,
      tenantId: config.demoTenantId,
      role: 'ADMIN',
    };
    next();
    return;
  }

  const sessionId = getSessionId(req);
  if (!sessionId) {
    res.status(401).json({ error: 'Missing session' });
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }

  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    res.status(401).json({ error: 'Session expired' });
    return;
  }

  req.user = {
    userId: session.userId,
    tenantId: config.demoTenantId,
    role: session.role as 'ADMIN' | 'MANAGER' | 'SALES_REP',
  };
  next();
}