import type { NextFunction, Request, Response } from 'express';
/** Domain error carrying an HTTP status code. */
export declare class HttpError extends Error {
    readonly status: number;
    constructor(status: number, message: string);
}
export declare function notFoundHandler(_req: Request, res: Response): void;
export declare function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void;
