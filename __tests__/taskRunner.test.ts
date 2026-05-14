import { TestDataSource } from './testDataSource';
import { Task } from '../src/models/Task';
import { Workflow } from '../src/models/Workflow';
import { TaskRunner, TaskStatus } from '../src/workers/taskRunner';
import { WorkflowStatus } from '../src/workflows/WorkflowFactory';

beforeAll(async () => {
    await TestDataSource.initialize();
});

afterAll(async () => {
    await TestDataSource.destroy();
});

/** Helper: create a minimal workflow + one or more tasks and persist them. */
async function createWorkflowWithTasks(
    tasks: Array<{ taskType: string; stepNumber: number; geoJson?: string; dependsOnTaskId?: string }>
): Promise<{ workflow: Workflow; tasks: Task[] }> {
    const workflowRepo = TestDataSource.getRepository(Workflow);
    const taskRepo = TestDataSource.getRepository(Task);

    const workflow = new Workflow();
    workflow.clientId = 'test-client';
    workflow.status = WorkflowStatus.Initial;
    const savedWorkflow = await workflowRepo.save(workflow);

    const validGeoJson = JSON.stringify({
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
    });

    const savedTasks: Task[] = [];
    for (const t of tasks) {
        const task = new Task();
        task.clientId = 'test-client';
        task.geoJson = t.geoJson ?? validGeoJson;
        task.status = TaskStatus.Queued;
        task.taskType = t.taskType;
        task.stepNumber = t.stepNumber;
        task.workflow = savedWorkflow;
        task.dependsOnTaskId = t.dependsOnTaskId ?? null;
        savedTasks.push(await taskRepo.save(task));
    }

    return { workflow: savedWorkflow, tasks: savedTasks };
}

describe('TaskRunner', () => {
    it('marks task Completed and writes output for a successful job (polygonArea)', async () => {
        const { tasks } = await createWorkflowWithTasks([
            { taskType: 'polygonArea', stepNumber: 1 },
        ]);
        const task = tasks[0];

        const taskRepo = TestDataSource.getRepository(Task);
        const runner = new TaskRunner(taskRepo);
        // Reload with workflow relation so reconcileWorkflow can find it
        const fullTask = await taskRepo.findOne({
            where: { taskId: task.taskId },
            relations: ['workflow'],
        });

        await runner.run(fullTask!);

        const updated = await taskRepo.findOne({ where: { taskId: task.taskId } });
        expect(updated!.status).toBe(TaskStatus.Completed);
        expect(updated!.output).toBeTruthy();
        const parsed = JSON.parse(updated!.output!);
        expect(parsed.areaSqMeters).toBeGreaterThan(0);
    });

    it('marks task Failed and sets progress on job error', async () => {
        const { tasks } = await createWorkflowWithTasks([
            // invalid GeoJSON will cause PolygonAreaJob to throw
            { taskType: 'polygonArea', stepNumber: 1, geoJson: 'not-json' },
        ]);
        const task = tasks[0];

        const taskRepo = TestDataSource.getRepository(Task);
        const runner = new TaskRunner(taskRepo);
        const fullTask = await taskRepo.findOne({
            where: { taskId: task.taskId },
            relations: ['workflow'],
        });

        // TaskRunner catches internally — should NOT throw
        await runner.run(fullTask!);

        const updated = await taskRepo.findOne({ where: { taskId: task.taskId } });
        expect(updated!.status).toBe(TaskStatus.Failed);
        expect(updated!.progress).toBeTruthy();
    });

    it('writes finalResult on workflow after the last task completes', async () => {
        const { tasks } = await createWorkflowWithTasks([
            { taskType: 'polygonArea', stepNumber: 1 },
        ]);

        const taskRepo = TestDataSource.getRepository(Task);
        const runner = new TaskRunner(taskRepo);
        const fullTask = await taskRepo.findOne({
            where: { taskId: tasks[0].taskId },
            relations: ['workflow'],
        });

        await runner.run(fullTask!);

        const workflowRepo = TestDataSource.getRepository(Workflow);
        const updatedWorkflow = await workflowRepo.findOne({
            where: { workflowId: tasks[0].workflow!.workflowId },
        });

        expect(updatedWorkflow!.status).toBe(WorkflowStatus.Completed);
        expect(updatedWorkflow!.finalResult).toBeTruthy();
        const result = JSON.parse(updatedWorkflow!.finalResult!);
        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0].status).toBe(TaskStatus.Completed);
    });

    it('includes error info in finalResult when a task fails', async () => {
        const { tasks } = await createWorkflowWithTasks([
            { taskType: 'polygonArea', stepNumber: 1, geoJson: 'bad-json' },
        ]);

        const taskRepo = TestDataSource.getRepository(Task);
        const runner = new TaskRunner(taskRepo);
        const fullTask = await taskRepo.findOne({
            where: { taskId: tasks[0].taskId },
            relations: ['workflow'],
        });

        await runner.run(fullTask!);

        const workflowRepo = TestDataSource.getRepository(Workflow);
        const updatedWorkflow = await workflowRepo.findOne({
            where: { workflowId: tasks[0].workflow!.workflowId },
        });

        expect(updatedWorkflow!.status).toBe(WorkflowStatus.Failed);
        const result = JSON.parse(updatedWorkflow!.finalResult!);
        expect(result.tasks[0].status).toBe(TaskStatus.Failed);
        expect(result.tasks[0].error).toBeTruthy();
    });

    it('short-circuits dependent task as Failed when dependency failed', async () => {
        const { tasks } = await createWorkflowWithTasks([
            { taskType: 'polygonArea', stepNumber: 1, geoJson: 'bad-json' },
            { taskType: 'analysis', stepNumber: 2 }, // will have dependsOnTaskId set below
        ]);

        const taskRepo = TestDataSource.getRepository(Task);
        // Wire the dependency manually
        tasks[1].dependsOnTaskId = tasks[0].taskId;
        await taskRepo.save(tasks[1]);

        const runner = new TaskRunner(taskRepo);

        // Run the first (failing) task
        const step1 = await taskRepo.findOne({
            where: { taskId: tasks[0].taskId },
            relations: ['workflow'],
        });
        await runner.run(step1!);

        // Run the second task — it should short-circuit as Failed
        const step2 = await taskRepo.findOne({
            where: { taskId: tasks[1].taskId },
            relations: ['workflow'],
        });
        await runner.run(step2!);

        const updatedStep2 = await taskRepo.findOne({ where: { taskId: tasks[1].taskId } });
        expect(updatedStep2!.status).toBe(TaskStatus.Failed);
        expect(updatedStep2!.progress).toMatch(/failed/i);
    });
});
