import 'dotenv/config';
import 'reflect-metadata';
import express, { NextFunction, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec, swaggerOptions } from './swagger';
import analysisRoutes from './routes/analysisRoutes';
import workflowRoutes from './routes/workflowRoutes';
import defaultRoute from './routes/defaultRoute';
import { taskWorker } from './worker/taskWorker';
import { AppDataSource } from './data-source';
import { config } from './config';
import { logger } from './logger';
import pinoHttp from 'pino-http';

const app = express();
app.use(pinoHttp({ logger }));
app.use(express.json({ limit: config.BODY_LIMIT }));

// Swagger UI — available at /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions));
// Raw OpenAPI JSON spec (handy for importing into Postman, Insomnia, etc.)
app.get('/api-docs.json', (_req: Request, res: Response) => { res.json(swaggerSpec); });

// API routes — must be registered before the catch-all '/' renderer
app.use('/analysis', analysisRoutes);
app.use('/workflow', workflowRoutes);

// Catch-all: renders README.md as styled HTML
app.use('/', defaultRoute);

// Express 5 JSON error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({ message: err.message ?? 'Internal server error' });
});

AppDataSource.initialize()
    .then(() => {
        logger.info('Database initialised.');
        taskWorker();

        app.listen(config.PORT, () => {
            logger.info(`Server running at http://localhost:${config.PORT}`);
            logger.info(`API Playground: http://localhost:${config.PORT}/api-docs`);
        });
    })
    .catch((error) => {
        logger.fatal({ err: error }, 'Failed to initialise database');
        process.exit(1);
    });
