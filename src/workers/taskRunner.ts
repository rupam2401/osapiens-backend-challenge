import { Repository } from 'typeorm';
import { Task } from '../models/Task';
import { getJobForTaskType } from '../jobs/JobFactory';
import { WorkflowStatus } from '../workflows/WorkflowFactory';
import { Workflow } from '../models/Workflow';
import { Result } from '../models/Result';

export enum TaskStatus {
    Queued = 'queued',
    InProgress = 'in_progress',
    Completed = 'completed',
    Failed = 'failed'
}

/** Attempt JSON.parse; on failure return the raw value. */
function safeParse(value: string | null | undefined): unknown {
    if (value == null) return null;
    try { return JSON.parse(value); } catch { return value; }
}

export class TaskRunner {
    constructor(
        private taskRepository: Repository<Task>,
    ) {}

    /**
     * Runs the appropriate job for the given task, managing all state transitions.
     *
     * Flow:
     *  1. Mark task in_progress.
     *  2. If the task has a dependency and it Failed, short-circuit this task as Failed.
     *  3. Otherwise load the dependency output (if any) and call job.run().
     *  4. On success: persist output to Task.output and Result.data; mark Completed.
     *  5. On error: mark Failed, store error message in Task.progress.
     *  6. In finally: always reconcile the workflow status and write finalResult if terminal.
     */
    async run(task: Task): Promise<void> {
        // ------------------------------------------------------------------ //
        // Phase 1: mark in_progress
        // ------------------------------------------------------------------ //
        task.status = TaskStatus.InProgress;
        task.progress = 'starting job...';
        await this.taskRepository.save(task);

        const resultRepository = this.taskRepository.manager.getRepository(Result);

        try {
            // ------------------------------------------------------------------ //
            // Phase 2: dependency check – short-circuit if dependency failed
            // ------------------------------------------------------------------ //
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
                        `Skipping this task.`
                    );
                }
            }

            // ------------------------------------------------------------------ //
            // Phase 3: build context from dependency output and run the job
            // ------------------------------------------------------------------ //
            const job = getJobForTaskType(task.taskType);
            let context = undefined;

            if (task.dependsOnTaskId) {
                const depTask = await this.taskRepository.findOne({
                    where: { taskId: task.dependsOnTaskId },
                });
                context = { dependencyOutput: safeParse(depTask?.output) };
            }

            console.log(`Starting job "${task.taskType}" for task ${task.taskId}...`);
            const jobResult = await job.run(task, context);
            console.log(`Job "${task.taskType}" for task ${task.taskId} completed successfully.`);

            // ------------------------------------------------------------------ //
            // Phase 4: persist output
            // ------------------------------------------------------------------ //
            const outputStr = typeof jobResult === 'string'
                ? jobResult
                : JSON.stringify(jobResult ?? {});

            task.output = outputStr;
            task.status = TaskStatus.Completed;
            task.progress = null;

            // Keep the Result entity populated for backward-compatibility
            const result = new Result();
            result.taskId = task.taskId!;
            result.data = outputStr;
            await resultRepository.save(result);
            task.resultId = result.resultId!;

            await this.taskRepository.save(task);

        } catch (error: any) {
            // ------------------------------------------------------------------ //
            // Phase 5: mark failed, store message
            // ------------------------------------------------------------------ //
            console.error(`Error running job "${task.taskType}" for task ${task.taskId}:`, error);
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
            console.error(`reconcileWorkflow: workflow ${workflowId} not found`);
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
