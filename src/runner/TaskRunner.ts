import { Repository } from 'typeorm';
import { Task } from '../models/Task';
import { getJobForTaskType } from '../jobs/JobFactory';
import { WorkflowStatus } from '../domain/WorkflowStatus';
import { TaskStatus } from '../domain/TaskStatus';
import { Workflow } from '../models/Workflow';
import { safeParse } from '../utils/safeParse';
import { logger } from '../logger';

const log = logger.child({ module: 'TaskRunner' });

export class TaskRunner {
    constructor(
        private taskRepository: Repository<Task>,
    ) {}

    /**
     * Runs the appropriate job for the given task, managing all state transitions.
     *
     * Flow:
     *  1. Mark task in_progress.
     *  2. If the task has a dependency: load it once. If the dependency
     *     failed, short-circuit this task as Failed.
     *  3. Build context from the (already-loaded) dependency output and
     *     call job.run().
     *  4. On success: persist output to Task.output; mark Completed.
     *  5. On error: mark Failed, store error message in Task.progress.
     *  6. In finally: always reconcile the workflow status and write
     *     finalResult if terminal.
     */
    async run(task: Task): Promise<void> {
        // ------------------------------------------------------------------ //
        // Phase 1: mark in_progress
        // ------------------------------------------------------------------ //
        task.status = TaskStatus.InProgress;
        task.progress = 'starting job...';
        await this.taskRepository.save(task);

        try {
            // ------------------------------------------------------------------ //
            // Phase 2+3: dependency lookup (single fetch) + context build
            // ------------------------------------------------------------------ //
            let context: { dependencyOutput?: unknown } | undefined;
            if (task.dependsOnTaskId) {
                const depTask = await this.taskRepository.findOne({
                    where: { taskId: task.dependsOnTaskId },
                });

                if (!depTask) {
                    throw new Error(`Dependency task ${task.dependsOnTaskId} not found`);
                }

                if (depTask.status === TaskStatus.Failed) {
                    throw new Error(
                        `Dependency task ${task.dependsOnTaskId} (step ${depTask.stepNumber}) failed. ` +
                        `Skipping this task.`,
                    );
                }

                context = { dependencyOutput: safeParse(depTask.output) };
            }

            const job = getJobForTaskType(task.taskType);

            log.info({ taskId: task.taskId, taskType: task.taskType }, 'Starting job');
            const jobResult = await job.run(task, context);
            log.info({ taskId: task.taskId, taskType: task.taskType }, 'Job completed successfully');

            // ------------------------------------------------------------------ //
            // Phase 4: persist output
            // ------------------------------------------------------------------ //
            const outputStr = typeof jobResult === 'string'
                ? jobResult
                : JSON.stringify(jobResult ?? {});

            task.output = outputStr;
            task.status = TaskStatus.Completed;
            task.progress = null;

            await this.taskRepository.save(task);

        } catch (error: any) {
            // ------------------------------------------------------------------ //
            // Phase 5: mark failed, store message
            // ------------------------------------------------------------------ //
            log.error({ taskId: task.taskId, taskType: task.taskType, err: error }, 'Job error');
            task.status = TaskStatus.Failed;
            task.progress = (error instanceof Error ? error.message : String(error));
            await this.taskRepository.save(task);

        } finally {
            // ------------------------------------------------------------------ //
            // Phase 6: always reconcile workflow (fixes the bug where catch+throw
            // skipped this block in the original implementation)
            // ------------------------------------------------------------------ //
            await this.reconcileWorkflow(task.workflow.workflowId);
        }
    }

    /**
     * Reloads the workflow with all its tasks, determines the new status, and — if
     * the workflow just reached a terminal state — writes the aggregated finalResult.
     */
    private async reconcileWorkflow(workflowId: string): Promise<void> {
        const workflowRepository = this.taskRepository.manager.getRepository(Workflow);
        const workflow = await workflowRepository.findOne({
            where: { workflowId },
            relations: ['tasks'],
        });

        if (!workflow) {
            log.error({ workflowId }, 'reconcileWorkflow: workflow not found');
            return;
        }

        const { tasks } = workflow;
        const allTerminal = tasks.every(t =>
            t.status === TaskStatus.Completed || t.status === TaskStatus.Failed
        );
        const anyFailed = tasks.some(t => t.status === TaskStatus.Failed);
        const allCompleted = tasks.every(t => t.status === TaskStatus.Completed);

        let newStatus: WorkflowStatus;
        if (allCompleted) {
            newStatus = WorkflowStatus.Completed;
        } else if (allTerminal && anyFailed) {
            newStatus = WorkflowStatus.Failed;
        } else {
            newStatus = WorkflowStatus.InProgress;
        }

        workflow.status = newStatus;

        // Write finalResult exactly once when the workflow first becomes terminal
        if (allTerminal && workflow.finalResult == null) {
            const taskSummaries = tasks
                .slice()
                .sort((a, b) => a.stepNumber - b.stepNumber)
                .map(t => ({
                    taskId: t.taskId,
                    type: t.taskType,
                    stepNumber: t.stepNumber,
                    status: t.status,
                    output: t.status === TaskStatus.Completed ? safeParse(t.output) : null,
                    error: t.status === TaskStatus.Failed ? (t.progress ?? 'unknown error') : null,
                }));

            workflow.finalResult = JSON.stringify({
                workflowId,
                status: newStatus,
                tasks: taskSummaries,
            });
        }

        await workflowRepository.save(workflow);
    }
}
