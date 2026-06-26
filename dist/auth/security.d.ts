import type { AuthUser, JwtPayloadShape } from '../types';
export declare function hashPassword(plain: string): Promise<string>;
export declare function verifyPassword(plain: string, hash: string): Promise<boolean>;
/** Sign a stateless JWT carrying the tenant + role claims used for AuthZ. */
export declare function signToken(payload: JwtPayloadShape): string;
/**
 * Verify a token's signature/expiry and return a strongly-typed principal.
 * Throws if the token is invalid or the payload is malformed.
 */
export declare function verifyToken(token: string): AuthUser;
