"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const session_store_1 = require("../../src/utils/session-store");
async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const sessionId = (0, session_store_1.getSessionIdFromCookie)(req);
    if (!sessionId) {
        return res.status(401).json({ error: 'No session' });
    }
    const session = (0, session_store_1.getSession)(sessionId);
    if (!session) {
        return res.status(401).json({ error: 'Session expired' });
    }
    // Match the frontend's expected user shape:
    //   sessionData.user.id, sessionData.user.name, sessionData.user.email, sessionData.user.role
    return res.status(200).json({
        user: {
            id: session.user.userId,
            name: session.user.displayName,
            email: session.user.email,
            role: session.user.role,
        },
        session: {
            id: sessionId,
            token: sessionId,
        },
    });
}
//# sourceMappingURL=session.js.map