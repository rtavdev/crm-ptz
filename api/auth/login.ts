import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateSessionId, setSession } from '../../src/utils/session-store';
import type { NeonAuthUser } from '../../src/utils/session-store';

interface UserRecord {
  password: string;
  display: string;
}

const ACCESS_LIST: Record<string, UserRecord> = {
  "dev":        { password:"3058", display:"Developer"},
  "rohan":      { password: "RTAV",  display: "Rohan" },
  "roshan":     { password: "1410",  display: "Roshan" },
  "mahalaxmi":  { password: "1234",  display: "Mahalaxmi" },
  "deepali":    { password: "1234",  display: "Deepali" },
  "sanjay":     { password: "1234",  display: "Sanjay" },
  "terence":    { password: "091177",  display: "Terence" },
  "lydia":      { password: "RTAV",  display: "Lydia" },
  "akhilesh":   { password: "Akhil1607", display:"Akhilesh"}
};

function setSessionCookie(res: VercelResponse, sessionId: string) {
  res.setHeader('Set-Cookie', [
    `neon_auth_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
  ]);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body || {};
  const username = email ? email.split('@')[0].toLowerCase() : '';
  const userRecord = ACCESS_LIST[username];

  if (!userRecord || userRecord.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const neonUser: NeonAuthUser = {
    userId: username,
    email,
    displayName: userRecord.display,
    role: username === 'dev' ? 'ADMIN' : 'USER',
  };

  const sessionId = generateSessionId();
  setSession(sessionId, { user: neonUser, expiresAt: Date.now() + 86400000 });
  setSessionCookie(res, sessionId);

  return res.status(200).json({
    user: neonUser,
    session: {
      id: sessionId,
      token: sessionId,  // Frontend expects data.session.token
    },
  });
}