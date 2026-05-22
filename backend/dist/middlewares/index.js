"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exampleMiddleware = void 0;
const exampleMiddleware = (req, res, next) => {
    // Middleware logic here
    next();
};
exports.exampleMiddleware = exampleMiddleware;
