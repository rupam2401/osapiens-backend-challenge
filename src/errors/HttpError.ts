/**
 * Error type that carries an HTTP status code through Express's
 * next(err) plumbing. The central errorHandler middleware reads
 * `statusCode` to set the response status and serialises `message`
 * (plus optional `details`) into the JSON body.
 *
 * Use it from routes, services, or any layer that wants to short-circuit
 * a request with a specific HTTP status: `throw new HttpError(404, 'not found')`.
 */
export class HttpError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string,
        public readonly details?: unknown,
    ) {
        super(message);
        this.name = 'HttpError';
    }
}
