import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSession, getSessionIdFromCookie } from '../../src/utils/session-store';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = getSessionIdFromCookie(req);
  if (!sessionId) {
    return res.status(401).json({ error: 'No session' });
  }

  const session = getSession(sessionId);
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