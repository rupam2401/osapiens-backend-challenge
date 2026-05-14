import 'reflect-metadata';
import express, { NextFunction, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec, swaggerOptions } from './swagger';
import analysisRoutes from './routes/analysisRoutes';
import workflowRoutes from './routes/workflowRoutes';
import defaultRoute from './routes/defaultRoute';
import { taskWorker } from './worker/taskWorker';
import { AppDataSource } from './data-source';

const app = express();
app.use(express.json());

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
    console.error('Unhandled error:', err);
    res.status(500).json({ message: err.message ?? 'Internal server error' });
});

AppDataSource.initialize()
    .then(() => {
        console.log('Database initialised.');
        taskWorker();

        app.listen(3000, () => {
            console.log('Server is running at http://localhost:3000');
            console.log('API Playground:  http://localhost:3000/api-docs');
        });
    })
    .catch((error) => {
        console.error('Failed to initialise database:', error);
        process.exit(1);
    });
