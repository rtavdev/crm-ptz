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
export declare function getSession(sessionId: string): SessionData | null;
export declare function setSession(sessionId: string, data: SessionData): void;
export declare function deleteSession(sessionId: string): void;
export declare function generateSessionId(): string;
export declare function getSessionIdFromCookie(req: {
    headers: {
        cookie?: string;
    };
}): string | null;
export type { NeonAuthUser, SessionData };
