import path from 'path';
import { TestDataSource } from './testDataSource';
import { WorkflowFactory } from '../src/workflows/WorkflowFactory';
import { Task } from '../src/models/Task';

const YAML_DIR = path.join(__dirname, '../src/workflows');
const SAMPLE_GEOJSON = JSON.stringify({
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

beforeAll(async () => {
    await TestDataSource.initialize();
});

afterAll(async () => {
    await TestDataSource.destroy();
});

describe('WorkflowFactory.createWorkflowFromYAML', () => {
    it('creates a workflow with three tasks from example_workflow.yml', async () => {
        const factory = new WorkflowFactory(TestDataSource);
        const workflow = await factory.createWorkflowFromYAML(
            path.join(YAML_DIR, 'example_workflow.yml'),
            'client-1',
            SAMPLE_GEOJSON
        );

        expect(workflow.workflowId).toBeTruthy();

        const taskRepo = TestDataSource.getRepository(Task);
        const tasks = await taskRepo.find({
            where: { workflow: { workflowId: workflow.workflowId } },
            order: { stepNumber: 'ASC' },
        });

        expect(tasks).toHaveLength(3);
        expect(tasks[0].taskType).toBe('polygonArea');
        expect(tasks[1].taskType).toBe('analysis');
        expect(tasks[2].taskType).toBe('reportGeneration');
    });

    it('wires dependsOnTaskId correctly for dependent steps', async () => {
        const factory = new WorkflowFactory(TestDataSource);
        const workflow = await factory.createWorkflowFromYAML(
            path.join(YAML_DIR, 'example_workflow.yml'),
            'client-2',
            SAMPLE_GEOJSON
        );

        const taskRepo = TestDataSource.getRepository(Task);
        const tasks = await taskRepo.find({
            where: { workflow: { workflowId: workflow.workflowId } },
            order: { stepNumber: 'ASC' },
        });

        const [step1, step2, step3] = tasks;

        // Step 1 has no dependency
        expect(step1.dependsOnTaskId).toBeFalsy();

        // Step 2 depends on step 1
        expect(step2.dependsOnTaskId).toBe(step1.taskId);

        // Step 3 depends on step 2
        expect(step3.dependsOnTaskId).toBe(step2.taskId);
    });

    it('throws if dependsOn references a non-existent stepNumber', async () => {
        const factory = new WorkflowFactory(TestDataSource);
        // Write an inline YAML string to a temp location (or mock readFileSync)
        // For simplicity, test via the WorkflowFactory's validation in createWorkflowFromYAML
        // by supplying a YAML string via the yaml.load path — we test the factory logic
        // indirectly. The test below exercises the error branch via a crafted YAML file:
        const tmpYaml = path.join(__dirname, 'bad_workflow.yml');
        const fs = require('fs');
        fs.writeFileSync(tmpYaml, `
name: "bad"
steps:
  - taskType: "polygonArea"
    stepNumber: 1
    dependsOn: 99
`, 'utf8');

        await expect(
            factory.createWorkflowFromYAML(tmpYaml, 'client-bad', SAMPLE_GEOJSON)
        ).rejects.toThrow(/depends on stepNumber 99/);

        fs.unlinkSync(tmpYaml);
    });
});
