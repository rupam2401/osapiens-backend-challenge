/**
 * Central Express error handler.
 *
 * Recognises:
 *  - ZodError       → 400 with a parsed list of validation issues
 *  - HttpError      → its declared statusCode + message (+ optional details)
 *  - Everything else → 500 with a generic message; the original error is
 *                      logged so the actual cause is preserved server-side.
 *
 * Must be the LAST `app.use(...)` so it sees errors from every route.
 */
import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../errors/HttpError';
import { logger } from '../logger';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
        res.status(400).json({
            message: 'Validation failed',
            details: err.issues.map((i) => ({
                path: i.path.join('.') || '(root)',
                message: i.message,
            })),
        });
        return;
    }

    if (err instanceof HttpError) {
        res.status(err.statusCode).json({
            message: err.message,
            ...(err.details !== undefined ? { details: err.details } : {}),
        });
        return;
    }

    logger.error({ err }, 'Unhandled error');
    res.status(500).json({ message: err?.message ?? 'Internal server error' });
};
