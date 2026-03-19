import { Request, Response, NextFunction } from 'express';

export default function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';

    if (process.env.NODE_ENV === 'development') {
        console.error(err);
        return res.status(status).json({ error: message, stack: err.stack });
    }

    console.error(message);
    res.status(status).json({ error: message });
}