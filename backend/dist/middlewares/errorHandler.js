"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = errorHandler;
function errorHandler(err, req, res, next) {
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    if (process.env.NODE_ENV === 'development') {
        console.error(err);
        return res.status(status).json({ error: message, stack: err.stack });
    }
    console.error(message);
    res.status(status).json({ error: message });
}
