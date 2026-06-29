"use strict";
/**
 * Shared session store for Neon Auth.
 * Uses environment variable as fallback when in-memory doesn't persist
 * across serverless cold starts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSession = getSession;
exports.setSession = setSession;
exports.deleteSession = deleteSession;
exports.generateSessionId = generateSessionId;
exports.getSessionIdFromCookie = getSessionIdFromCookie;
// In-memory store (note: does NOT persist across Vercel cold starts)
const sessions = new Map();
function getSession(sessionId) {
    // Try in-memory first
    const session = sessions.get(sessionId);
    if (session) {
        if (Date.now() < session.expiresAt) {
            return session;
        }
        sessions.delete(sessionId);
        return null;
    }
    return null;
}
function setSession(sessionId, data) {
    sessions.set(sessionId, data);
}
function deleteSession(sessionId) {
    sessions.delete(sessionId);
}
function generateSessionId() {
    return Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join('');
}
function getSessionIdFromCookie(req) {
    const cookie = req.headers.cookie || '';
    const match = cookie.match(/neon_auth_session=([^;]+)/);
    return match ? match[1] : null;
}
//# sourceMappingURL=session-store.js.map