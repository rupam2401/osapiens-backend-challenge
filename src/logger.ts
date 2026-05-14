/**
 * Application-wide pino logger.
 *
 * - In development, formats via pino-pretty for human-readable output.
 * - In production, emits ndjson (one JSON object per line) on stdout — the
 *   format expected by Docker / Kubernetes log aggregators.
 *
 * Get a module-scoped child with `logger.child({ module: 'TaskRunner' })`
 * so log lines are attributable without manual prefixing.
 */
import pino from 'pino';
import { config } from './config';

const isDev = config.NODE_ENV !== 'production' && config.NODE_ENV !== 'test';
const isTest = config.NODE_ENV === 'test';

export const logger = pino({
    // Silence logs by default under jest; override with LOG_LEVEL if needed.
    level: isTest && process.env.LOG_LEVEL == null ? 'silent' : config.LOG_LEVEL,
    ...(isDev && {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss.l',
                ignore: 'pid,hostname',
            },
        },
    }),
});
