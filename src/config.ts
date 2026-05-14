/**
 * Centralised, typed application config.  Reads from `process.env` (which is
 * populated by `dotenv/config` in `index.ts`) and applies sensible defaults
 * for local dev. Values are read once at module load time and frozen.
 *
 * Add new settings here rather than reading `process.env` directly anywhere
 * else in the codebase — it keeps defaults discoverable and makes it easy to
 * swap to a stricter zod-backed validator later (planned).
 */

function num(name: string, fallback: number): number {
    const raw = process.env[name];
    if (raw == null || raw === '') return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
        throw new Error(`Config: ${name}="${raw}" is not a valid number`);
    }
    return parsed;
}

function str(name: string, fallback: string): string {
    const raw = process.env[name];
    return raw != null && raw !== '' ? raw : fallback;
}

export const config = Object.freeze({
    NODE_ENV: str('NODE_ENV', 'development'),
    PORT: num('PORT', 3000),
    DB_PATH: str('DB_PATH', 'data/database.sqlite'),
    WORKER_POLL_MS: num('WORKER_POLL_MS', 5000),
    LOG_LEVEL: str('LOG_LEVEL', 'info'),
    /** Maximum JSON body size accepted by express.json (string form, e.g. '256kb'). */
    BODY_LIMIT: str('BODY_LIMIT', '256kb'),
});

export type AppConfig = typeof config;
