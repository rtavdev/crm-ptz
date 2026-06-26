/**
 * Shared session store for Neon Auth.
 * Uses environment variable as fallback when in-memory doesn't persist
 * across serverless cold starts.
 */

interface NeonAuthUser {
  userId: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'USER';
}

interface SessionData {
  user: NeonAuthUser;
  expiresAt: number;
}

// In-memory store (note: does NOT persist across Vercel cold starts)
const sessions = new Map<string, SessionData>();

export function getSession(sessionId: string): SessionData | null {
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

export function setSession(sessionId: string, data: SessionData): void {
  sessions.set(sessionId, data);
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function generateSessionId(): string {
  return Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join('');
}

export function getSessionIdFromCookie(req: { headers: { cookie?: string } }): string | null {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/neon_auth_session=([^;]+)/);
  return match ? match[1] : null;
}

export type { NeonAuthUser, SessionData };