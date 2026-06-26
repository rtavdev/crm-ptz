"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpError = void 0;
exports.notFoundHandler = notFoundHandler;
exports.errorHandler = errorHandler;
/** Domain error carrying an HTTP status code. */
class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
    }
}
exports.HttpError = HttpError;
function notFoundHandler(_req, res) {
    res.status(404).json({ error: 'Not found' });
}
function errorHandler(err, _req, res, _next) {
    if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
    }
    // multer surfaces upload problems (e.g. file too large) as MulterError.
    if (typeof err === 'object' && err !== null && err.name === 'MulterError') {
        res.status(400).json({ error: `Upload error: ${err.message}` });
        return;
    }
    // eslint-disable-next-line no-console
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
}
//# sourceMappingURL=errorHandler.js.map