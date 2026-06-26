import type { NextFunction, Request, Response, RequestHandler } from 'express';
/** Wrap an async route handler so rejected promises reach the error middleware. */
export declare function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler;
