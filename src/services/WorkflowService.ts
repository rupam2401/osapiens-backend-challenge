/**
 * Application service that encapsulates workflow lifecycle operations.
 *
 * Routes call into here; the service owns repository access and throws
 * `HttpError` for cases where a specific status code is meaningful
 * (currently just 404). The 400 case for `/results` returns a DTO with
 * `completed: false` so the route can decide its own status code while
 * still letting the service own the body shape.
 */
import path from 'path';
import { DataSource } from 'typeorm';
import { Workflow } from '../models/Workflow';
import { Task } from '../models/Task';
import { TaskStatus } from '../domain/TaskStatus';
import { WorkflowStatus } from '../domain/WorkflowStatus';
import { WorkflowFactory } from '../workflows/WorkflowFactory';
import { HttpError } from '../errors/HttpError';
import { safeParse } from '../utils/safeParse';

const DEFAULT_WORKFLOW_YAML = path.join(__dirname, '../workflows/example_workflow.yml');

export interface StatusDTO {
    workflowId: string;
    status: WorkflowStatus;
    completedTasks: number;
    totalTasks: number;
}

export interface CompletedResultsDTO {
    completed: true;
    workflowId: string;
    status: WorkflowStatus;
    finalResult: unknown;
}

export interface PendingResultsDTO {
    completed: false;
    workflowId: string;
    status: WorkflowStatus;
    /** Partial finalResult may already be populated on Failed workflows. */
    finalResult: unknown;
    message: string;
}

export type ResultsDTO = CompletedResultsDTO | PendingResultsDTO;

export class WorkflowService {
    private readonly factory: WorkflowFactory;

    constructor(private readonly dataSource: DataSource) {
        this.factory = new WorkflowFactory(dataSource);
    }

    async createFromAnalysis(clientId: string, geoJson: unknown): Promise<{ workflowId: string }> {
        const workflow = await this.factory.createWorkflowFromYAML(
            DEFAULT_WORKFLOW_YAML,
            clientId,
            JSON.stringify(geoJson),
        );
        return { workflowId: workflow.workflowId };
    }

    async getStatus(workflowId: string): Promise<StatusDTO> {
        const workflowRepo = this.dataSource.getRepository(Workflow);
        const taskRepo = this.dataSource.getRepository(Task);

        const workflow = await workflowRepo.findOne({ where: { workflowId } });
        if (!workflow) {
            throw new HttpError(404, `Workflow ${workflowId} not found`);
        }

        const tasks = await taskRepo.find({ where: { workflow: { workflowId } } });
        const completedTasks = tasks.filter(t => t.status === TaskStatus.Completed).length;

        return {
            workflowId,
            status: workflow.status,
            completedTasks,
            totalTasks: tasks.length,
        };
    }

    async getResults(workflowId: string): Promise<ResultsDTO> {
        const workflowRepo = this.dataSource.getRepository(Workflow);
        const workflow = await workflowRepo.findOne({ where: { workflowId } });
        if (!workflow) {
            throw new HttpError(404, `Workflow ${workflowId} not found`);
        }

        if (workflow.status !== WorkflowStatus.Completed) {
            return {
                completed: false,
                workflowId,
                status: workflow.status,
                finalResult: workflow.finalResult ? safeParse(workflow.finalResult) : null,
                message: `Workflow is not yet completed (current status: ${workflow.status})`,
            };
        }

        return {
            completed: true,
            workflowId,
            status: workflow.status,
            finalResult: safeParse(workflow.finalResult),
        };
    }
}
