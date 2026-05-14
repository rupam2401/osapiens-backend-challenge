import 'dotenv/config';
import 'reflect-metadata';
import express, { Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec, swaggerOptions } from './swagger';
import analysisRoutes from './routes/analysisRoutes';
import workflowRoutes from './routes/workflowRoutes';
import healthRoutes from './routes/healthRoutes';
import defaultRoute from './routes/defaultRoute';
import { taskWorker } from './worker/taskWorker';
import { AppDataSource } from './data-source';
import { config } from './config';
import { logger } from './logger';
import pinoHttp from 'pino-http';
import { errorHandler } from './middleware/errorHandler';

const app = express();
app.use(pinoHttp({ logger }));
app.use(express.json({ limit: config.BODY_LIMIT }));

// Swagger UI — available at /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions));
// Raw OpenAPI JSON spec (handy for importing into Postman, Insomnia, etc.)
app.get('/api-docs.json', (_req: Request, res: Response) => {
    res.json(swaggerSpec);
});

// API routes — must be registered before the catch-all '/' renderer
app.use('/health', healthRoutes);
app.use('/analysis', analysisRoutes);
app.use('/workflow', workflowRoutes);

// Catch-all: renders README.md as styled HTML
app.use('/', defaultRoute);

// Central error handler — must come last
app.use(errorHandler);

const SHUTDOWN_TIMEOUT_MS = 10_000;

AppDataSource.initialize()
    .then(() => {
        logger.info('Database initialised.');

        const abortController = new AbortController();
        const workerPromise = taskWorker(abortController.signal);

        const server = app.listen(config.PORT, () => {
            logger.info(`Server running at http://localhost:${config.PORT}`);
            logger.info(`API Playground: http://localhost:${config.PORT}/api-docs`);
        });

        let shuttingDown = false;
        const shutdown = async (signal: NodeJS.Signals) => {
            if (shuttingDown) return;
            shuttingDown = true;
            logger.info({ signal }, 'Shutdown signal received; draining...');

            // 1. Stop accepting new HTTP connections.
            await new Promise<void>((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()));
            }).catch((err) => logger.error({ err }, 'Error closing HTTP server'));

            // 2. Signal the worker to stop after its current task.
            abortController.abort();

            // 3. Wait for the worker to drain, capped by SHUTDOWN_TIMEOUT_MS.
            await Promise.race([
                workerPromise,
                new Promise<void>((resolve) => setTimeout(resolve, SHUTDOWN_TIMEOUT_MS)),
            ]);

            // 4. Close DB connections last.
            await AppDataSource.destroy().catch((err) =>
                logger.error({ err }, 'Error destroying DataSource'),
            );

            logger.info('Shutdown complete.');
            process.exit(0);
        };

        process.on('SIGTERM', () => void shutdown('SIGTERM'));
        process.on('SIGINT', () => void shutdown('SIGINT'));
    })
    .catch((error) => {
        logger.fatal({ err: error }, 'Failed to initialise database');
        process.exit(1);
    });
