"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserIdFromSession = getUserIdFromSession;
exports.authenticateJWT = authenticateJWT;
const env_1 = require("../config/env");
if (!global.__neonSessions) {
    global.__neonSessions = new Map();
}
const sessions = global.__neonSessions;
/** Extract the session ID from the request's cookie header. */
function getSessionId(req) {
    const cookie = req.headers.cookie || '';
    const match = cookie.match(/neon_auth_session=([^;]+)/);
    return match?.[1] ?? null;
}
/** Get user_id from session cookie — used by Express middleware. */
/** Get user_id from session cookie — used by Express middleware. */
/** Get user_id from session cookie — used by Express middleware. */
function getUserIdFromSession(req) {
    const sessionId = getSessionId(req);
    if (!sessionId)
        return null;
    const session = sessions.get(sessionId);
    if (!session || Date.now() > session.expiresAt) {
        if (session)
            sessions.delete(sessionId);
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
function authenticateJWT(req, res, next) {
    const apiKey = req.header('x-api-key');
    if (apiKey !== undefined && apiKey === env_1.config.systemApiSecretKey) {
        req.user = {
            userId: env_1.config.demoOwnerId,
            tenantId: env_1.config.demoTenantId,
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
        tenantId: env_1.config.demoTenantId,
        role: session.role,
    };
    next();
}
//# sourceMappingURL=authenticate.js.map