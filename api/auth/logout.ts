import type { VercelRequest, VercelResponse } from '@vercel/node';

const sessions = new Map<string, { user: any; expiresAt: number }>();

function getSessionId(req: VercelRequest): string | null {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/neon_auth_session=([^;]+)/);
  return match ? match[1] : null;
}

function clearSessionCookie(res: VercelResponse) {
  res.setHeader('Set-Cookie', ['neon_auth_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0']);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = getSessionId(req);
  if (sessionId) sessions.delete(sessionId);
  clearSessionCookie(res);

  return res.status(200).json({ success: true });
}