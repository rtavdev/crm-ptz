import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionIdFromCookie, deleteSession } from '../../src/utils/session-store';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = getSessionIdFromCookie(req);
  if (sessionId) deleteSession(sessionId);

  res.setHeader('Set-Cookie', ['neon_auth_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0']);
  return res.status(200).json({ success: true });
}