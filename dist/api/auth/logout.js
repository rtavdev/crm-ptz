"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const session_store_1 = require("../../src/utils/session-store");
async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const sessionId = (0, session_store_1.getSessionIdFromCookie)(req);
    if (sessionId)
        (0, session_store_1.deleteSession)(sessionId);
    res.setHeader('Set-Cookie', ['neon_auth_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0']);
    return res.status(200).json({ success: true });
}
//# sourceMappingURL=logout.js.map