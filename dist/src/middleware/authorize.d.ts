import type { NextFunction, Request, Response } from 'express';
import type { AccessScope, Role } from '../types';
/** Map a role to its data-visibility scope. */
export declare function scopeForRole(role: Role): AccessScope;
/**
 * Inject `req.accessScope` based on the authenticated principal's role. Must run
 * after `authenticateJWT`. The route handlers consult this scope to decide
 * whether to constrain queries to records owned by the caller.
 */
export declare function injectAccessScope(req: Request, res: Response, next: NextFunction): void;
/** Guard a route so only the listed roles may proceed. */
export declare function requireRole(...allowed: Role[]): (req: Request, res: Response, next: NextFunction) => void;
