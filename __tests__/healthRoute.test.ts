/**
 * GET /health returns 200 when the DB responds to SELECT 1.
 */
import 'reflect-metadata';
import request from 'supertest';
import express from 'express';
import { TestDataSource } from './testDataSource';

jest.mock('../src/data-source', () => ({
    get AppDataSource() {
        return require('./testDataSource').TestDataSource;
    },
}));

const healthRoutes = require('../src/routes/healthRoutes').default;

const app = express();
app.use('/health', healthRoutes);

beforeAll(async () => {
    await TestDataSource.initialize();
});

afterAll(async () => {
    await TestDataSource.destroy();
});

describe('GET /health', () => {
    it('returns 200 ok when the DB is responsive', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });
});
