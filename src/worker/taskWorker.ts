import { AppDataSource } from '../data-source';
import { Task } from '../models/Task';
import { TaskRunner } from '../runner/TaskRunner';
import { TaskStatus } from '../domain/TaskStatus';
import { config } from '../config';
import { logger } from '../logger';

const log = logger.child({ module: 'taskWorker' });

/**
 * Finds the next queued task that is eligible to run.
 *
 * Eligibility rules:
 * 1. Status must be `queued`.
 * 2. Tasks are considered in ascending stepNumber order so earlier steps run first.
 * 3. If a task has a `dependsOnTaskId`, the referenced task must be `completed`
 *    before this task becomes eligible.
 *
 * Returns null if no eligible task exists right now.
 */
async function findNextEligibleTask(
    taskRepository: ReturnType<typeof AppDataSource.getRepository<Task>>,
): Promise<Task | null> {
    // Load all queued tasks ordered by stepNumber (ascending) with workflow relation
    const queuedTasks = await taskRepository.find({
        where: { status: TaskStatus.Queued },
        order: { stepNumber: 'ASC' },
        relations: ['workflow'],
    });

    if (queuedTasks.length === 0) {
        return null;
    }

    for (const task of queuedTasks) {
        if (!task.dependsOnTaskId) {
            // No dependency — immediately eligible
            return task;
        }

        // Check if the dependency task is completed
        const depTask = await taskRepository.findOne({
            where: { taskId: task.dependsOnTaskId },
        });

        if (depTask && depTask.status === TaskStatus.Completed) {
            return task;
        }

        // If dependency failed, the worker still yields this task; TaskRunner will
        // short-circuit it with a Failed status so the workflow can be reconciled.
        if (depTask && depTask.status === TaskStatus.Failed) {
            return task;
        }

        // Dependency still in-progress / queued — skip for now
    }

    return null;
}

/**
 * Sleeps for `ms` milliseconds or until `signal` aborts (whichever first).
 * Always resolves — never rejects on abort — so callers can simply loop.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        if (signal?.aborted) return resolve();
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(timer);
            resolve();
        };
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

/**
 * Background polling loop. Picks up the next eligible queued task,
 * runs it through TaskRunner, then sleeps for WORKER_POLL_MS.
 *
 * Pass an `AbortSignal` to stop the loop cleanly on shutdown; the
 * currently-running task (if any) is allowed to finish first.
 */
export async function taskWorker(signal?: AbortSignal): Promise<void> {
    const taskRepository = AppDataSource.getRepository(Task);
    const taskRunner = new TaskRunner(taskRepository);

    log.info('Worker started');

    while (!signal?.aborted) {
        const task = await findNextEligibleTask(taskRepository);

        if (task) {
            try {
                await taskRunner.run(task);
            } catch (error) {
                // TaskRunner already updated the task status — just log here.
                log.error(
                    { err: error, taskId: task.taskId },
                    'Task execution failed (status already updated by TaskRunner)',
                );
            }
        }

        if (signal?.aborted) break;
        await sleep(config.WORKER_POLL_MS, signal);
    }

    log.info('Worker stopped');
}
