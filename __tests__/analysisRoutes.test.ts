/**
 * Validation tests for POST /analysis.
 *
 * Mocks AppDataSource so a malformed payload is rejected by the zod
 * schema before any workflow is created.
 */
import 'reflect-metadata';
import request from 'supertest';
import express from 'express';
import { TestDataSource } from './testDataSource';
import { errorHandler } from '../src/middleware/errorHandler';

jest.mock('../src/data-source', () => ({
    get AppDataSource() {
        return require('./testDataSource').TestDataSource;
    },
}));

// Routes pulled in *after* the mock so AppDataSource resolves to the test DS.
const analysisRoutes = require('../src/routes/analysisRoutes').default;

const app = express();
app.use(express.json());
app.use('/analysis', analysisRoutes);
app.use(errorHandler);

beforeAll(async () => {
    await TestDataSource.initialize();
});

afterAll(async () => {
    await TestDataSource.destroy();
});

const VALID_GEOJSON = {
    type: 'Feature',
    geometry: {
        type: 'Polygon',
        coordinates: [
            [
                [-63.6249, -10.3111],
                [-63.6249, -10.3679],
                [-63.6128, -10.3679],
                [-63.6128, -10.3111],
                [-63.6249, -10.3111],
            ],
        ],
    },
    properties: {},
};

describe('POST /analysis — validation', () => {
    it('returns 400 when body is empty', async () => {
        const res = await request(app).post('/analysis').send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Validation failed');
        expect(res.body.details).toBeInstanceOf(Array);
    });

    it('returns 400 when clientId is missing', async () => {
        const res = await request(app).post('/analysis').send({ geoJson: VALID_GEOJSON });
        expect(res.status).toBe(400);
        expect(res.body.details.some((d: any) => d.path === 'clientId')).toBe(true);
    });

    it('returns 400 when geoJson is a Point geometry', async () => {
        const res = await request(app)
            .post('/analysis')
            .send({
                clientId: 'x',
                geoJson: { type: 'Point', coordinates: [0, 0] },
            });
        expect(res.status).toBe(400);
    });

    it('returns 202 for a valid body', async () => {
        const res = await request(app)
            .post('/analysis')
            .send({ clientId: 'x', geoJson: VALID_GEOJSON });
        expect(res.status).toBe(202);
        expect(res.body.workflowId).toBeTruthy();
    });
});
