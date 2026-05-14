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
async function findNextEligibleTask(taskRepository: ReturnType<typeof AppDataSource.getRepository<Task>>): Promise<Task | null> {
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

export async function taskWorker() {
    const taskRepository = AppDataSource.getRepository(Task);
    const taskRunner = new TaskRunner(taskRepository);

    while (true) {
        const task = await findNextEligibleTask(taskRepository);

        if (task) {
            try {
                await taskRunner.run(task);
            } catch (error) {
                // TaskRunner already updated the task status — just log here.
                log.error({ err: error, taskId: task.taskId }, 'Task execution failed (status already updated by TaskRunner)');
            }
        }

        // Wait before checking for the next task again
        await new Promise(resolve => setTimeout(resolve, config.WORKER_POLL_MS));
    }
}
