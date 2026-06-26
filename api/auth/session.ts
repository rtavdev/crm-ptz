import type { VercelRequest, VercelResponse } from '@vercel/node';

interface NeonAuthUser {
  userId: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'USER';
}

const sessions = new Map<string, { user: NeonAuthUser; expiresAt: number }>();

function getSessionId(req: VercelRequest): string | null {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/neon_auth_session=([^;]+)/);
  return match ? match[1] : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = getSessionId(req);
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({ error: 'No session' });
  }

  const session = sessions.get(sessionId)!;
  return res.status(200).json({ user: session.user, session: { id: sessionId } });
}