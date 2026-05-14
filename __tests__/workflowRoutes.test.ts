/**
 * Integration tests for GET /workflow/:id/status and GET /workflow/:id/results.
 *
 * These tests spin up the Express app against a TestDataSource (in-memory sqljs)
 * so no real server or sqlite file is needed.
 */
import 'reflect-metadata';
import request from 'supertest';
import express from 'express';
import { TestDataSource } from './testDataSource';
import workflowRoutes from '../src/routes/workflowRoutes';
import { errorHandler } from '../src/middleware/errorHandler';
import { Workflow } from '../src/models/Workflow';
import { Task } from '../src/models/Task';
import { WorkflowStatus } from '../src/domain/WorkflowStatus';
import { TaskStatus } from '../src/domain/TaskStatus';

// -------------------------------------------------------------------
// NOTE: workflowRoutes imports AppDataSource directly, so we need to
// swap it out for the TestDataSource in tests.  We do this by mocking
// the data-source module before importing the routes.
// -------------------------------------------------------------------
jest.mock('../src/data-source', () => ({
    get AppDataSource() {
        return require('./testDataSource').TestDataSource;
    },
}));

const app = express();
app.use(express.json());
app.use('/workflow', workflowRoutes);
app.use(errorHandler);

// -------------------------------------------------------------------
// Setup / teardown
// -------------------------------------------------------------------
beforeAll(async () => {
    await TestDataSource.initialize();
});

afterAll(async () => {
    await TestDataSource.destroy();
});

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
async function createWorkflow(status: WorkflowStatus, finalResult?: string): Promise<Workflow> {
    const repo = TestDataSource.getRepository(Workflow);
    const workflow = new Workflow();
    workflow.clientId = 'test-client';
    workflow.status = status;
    if (finalResult) workflow.finalResult = finalResult;
    return repo.save(workflow);
}

async function addTask(workflow: Workflow, taskStatus: TaskStatus, stepNumber = 1): Promise<Task> {
    const repo = TestDataSource.getRepository(Task);
    const task = new Task();
    task.clientId = 'test-client';
    task.geoJson = '{}';
    task.taskType = 'analysis';
    task.stepNumber = stepNumber;
    task.status = taskStatus;
    task.workflow = workflow;
    return repo.save(task);
}

// -------------------------------------------------------------------
// GET /workflow/:id/status
// -------------------------------------------------------------------
describe('GET /workflow/:id/status', () => {
    it('returns 404 for a non-existent workflow', async () => {
        const res = await request(app).get('/workflow/00000000-0000-0000-0000-000000000000/status');
        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/not found/i);
    });

    it('returns 200 with counters for an in-progress workflow', async () => {
        const workflow = await createWorkflow(WorkflowStatus.InProgress);
        await addTask(workflow, TaskStatus.Completed, 1);
        await addTask(workflow, TaskStatus.Queued, 2);

        const res = await request(app).get(`/workflow/${workflow.workflowId}/status`);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            workflowId: workflow.workflowId,
            status: WorkflowStatus.InProgress,
            completedTasks: 1,
            totalTasks: 2,
        });
    });

    it('returns completedTasks = totalTasks for a completed workflow', async () => {
        const workflow = await createWorkflow(WorkflowStatus.Completed);
        await addTask(workflow, TaskStatus.Completed, 1);
        await addTask(workflow, TaskStatus.Completed, 2);

        const res = await request(app).get(`/workflow/${workflow.workflowId}/status`);
        expect(res.status).toBe(200);
        expect(res.body.completedTasks).toBe(2);
        expect(res.body.totalTasks).toBe(2);
    });
});

// -------------------------------------------------------------------
// GET /workflow/:id/results
// -------------------------------------------------------------------
describe('GET /workflow/:id/results', () => {
    it('returns 404 for a non-existent workflow', async () => {
        const res = await request(app).get(
            '/workflow/00000000-0000-0000-0000-000000000001/results',
        );
        expect(res.status).toBe(404);
    });

    it('returns 400 when workflow is in_progress', async () => {
        const workflow = await createWorkflow(WorkflowStatus.InProgress);
        const res = await request(app).get(`/workflow/${workflow.workflowId}/results`);
        expect(res.status).toBe(400);
        expect(res.body.status).toBe(WorkflowStatus.InProgress);
    });

    it('returns 400 when workflow has failed (with partial finalResult)', async () => {
        const partialResult = JSON.stringify({ workflowId: 'x', status: 'failed', tasks: [] });
        const workflow = await createWorkflow(WorkflowStatus.Failed, partialResult);
        const res = await request(app).get(`/workflow/${workflow.workflowId}/results`);
        expect(res.status).toBe(400);
        expect(res.body.finalResult).toBeTruthy();
    });

    it('returns 200 with parsed finalResult for a completed workflow', async () => {
        const finalResult = JSON.stringify({
            workflowId: 'some-id',
            status: 'completed',
            tasks: [
                {
                    taskId: 'tid',
                    type: 'polygonArea',
                    status: 'completed',
                    output: { areaSqMeters: 42 },
                    error: null,
                },
            ],
        });
        const workflow = await createWorkflow(WorkflowStatus.Completed, finalResult);

        const res = await request(app).get(`/workflow/${workflow.workflowId}/results`);
        expect(res.status).toBe(200);
        expect(res.body.workflowId).toBe(workflow.workflowId);
        expect(res.body.status).toBe(WorkflowStatus.Completed);
        expect(res.body.finalResult.tasks[0].output.areaSqMeters).toBe(42);
    });
});
