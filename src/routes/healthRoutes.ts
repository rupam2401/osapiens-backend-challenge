/**
 * Liveness / readiness probe. Pings the database with a trivial
 * `SELECT 1` so a 200 response means both the HTTP server and the
 * SQLite DataSource are responsive.
 */
import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { logger } from '../logger';

const router = Router();
const log = logger.child({ module: 'healthRoutes' });

router.get('/', async (_req, res) => {
    try {
        await AppDataSource.query('SELECT 1');
        res.status(200).json({ status: 'ok' });
    } catch (err) {
        log.error({ err }, 'Health check failed');
        res.status(503).json({ status: 'unhealthy' });
    }
});

export default router;
