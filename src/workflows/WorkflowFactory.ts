import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { DataSource } from 'typeorm';
import { Workflow } from '../models/Workflow';
import { Task } from '../models/Task';
import { TaskStatus } from '../domain/TaskStatus';
import { WorkflowStatus } from '../domain/WorkflowStatus';

interface WorkflowStep {
    taskType: string;
    stepNumber: number;
    /** stepNumber of the task this step depends on. Null means no dependency. */
    dependsOn?: number;
}

interface WorkflowDefinition {
    name: string;
    steps: WorkflowStep[];
}

export class WorkflowFactory {
    constructor(private dataSource: DataSource) {}

    /**
     * Creates a workflow by reading a YAML file and constructing the Workflow and Task entities.
     *
     * Supports an optional `dependsOn` field per step (stepNumber of the prerequisite task).
     * Two-pass save: first saves all tasks, then resolves `dependsOn` stepNumber → taskId.
     *
     * @param filePath - Path to the YAML file.
     * @param clientId - Client identifier for the workflow.
     * @param geoJson  - The geoJson data string shared across tasks.
     */
    async createWorkflowFromYAML(
        filePath: string,
        clientId: string,
        geoJson: string,
    ): Promise<Workflow> {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const workflowDef = yaml.load(fileContent) as WorkflowDefinition;

        const workflowRepository = this.dataSource.getRepository(Workflow);
        const taskRepository = this.dataSource.getRepository(Task);

        // Persist the workflow shell first
        const workflow = new Workflow();
        workflow.clientId = clientId;
        workflow.status = WorkflowStatus.Initial;
        const savedWorkflow = await workflowRepository.save(workflow);

        // Pass 1: create and save all tasks (without dependency links yet)
        const tasks: Task[] = workflowDef.steps.map((step) => {
            const task = new Task();
            task.clientId = clientId;
            task.geoJson = geoJson;
            task.status = TaskStatus.Queued;
            task.taskType = step.taskType;
            task.stepNumber = step.stepNumber;
            task.workflow = savedWorkflow;
            task.dependsOnTaskId = null;
            return task;
        });

        const savedTasks = await taskRepository.save(tasks);

        // Build a map of stepNumber → saved taskId for dependency resolution
        const stepToTaskId = new Map<number, string>();
        for (const t of savedTasks) {
            stepToTaskId.set(t.stepNumber, t.taskId);
        }

        // Pass 2: wire dependsOnTaskId where the YAML specifies `dependsOn`
        const tasksNeedingUpdate: Task[] = [];
        for (let i = 0; i < workflowDef.steps.length; i++) {
            const step = workflowDef.steps[i];
            if (step.dependsOn != null) {
                const depTaskId = stepToTaskId.get(step.dependsOn);
                if (!depTaskId) {
                    throw new Error(
                        `Workflow "${workflowDef.name}": step ${step.stepNumber} depends on ` +
                            `stepNumber ${step.dependsOn} but no such step exists in this workflow.`,
                    );
                }
                const task = savedTasks[i];
                task.dependsOnTaskId = depTaskId;
                tasksNeedingUpdate.push(task);
            }
        }

        if (tasksNeedingUpdate.length > 0) {
            await taskRepository.save(tasksNeedingUpdate);
        }

        return savedWorkflow;
    }
}
