import { Job, JobContext } from './Job';
import { Task } from '../models/Task';
import { AppDataSource } from '../data-source';
import { TaskStatus } from '../domain/TaskStatus';
import { safeParse } from '../utils/safeParse';
import { logger } from '../logger';

const log = logger.child({ module: 'ReportGenerationJob' });

export class ReportGenerationJob implements Job {
    async run(task: Task, _context?: JobContext): Promise<string> {
        log.debug({ taskId: task.taskId, workflowId: task.workflow.workflowId }, 'Generating report');

        // Reload workflow tasks so we have the latest state and outputs
        const taskRepository = AppDataSource.getRepository(Task);
        const siblingTasks = await taskRepository.find({
            where: { workflow: { workflowId: task.workflow.workflowId } },
            order: { stepNumber: 'ASC' },
            relations: ['workflow'],
        });

        // Only aggregate tasks that ran before this one
        const precedingTasks = siblingTasks.filter(t => t.stepNumber < task.stepNumber);

        const taskEntries = precedingTasks.map(t => ({
            taskId: t.taskId,
            type: t.taskType,
            stepNumber: t.stepNumber,
            status: t.status,
            output: t.status === TaskStatus.Completed ? safeParse(t.output) : null,
            error: t.status === TaskStatus.Failed ? (t.progress ?? 'unknown error') : null,
        }));

        const completedCount = taskEntries.filter(t => t.status === TaskStatus.Completed).length;
        const failedCount = taskEntries.filter(t => t.status === TaskStatus.Failed).length;

        const finalReport =
            failedCount > 0
                ? `${completedCount} of ${taskEntries.length} preceding tasks completed successfully; ${failedCount} failed.`
                : `All ${completedCount} preceding tasks completed successfully.`;

        const report = {
            workflowId: task.workflow.workflowId,
            tasks: taskEntries,
            finalReport,
        };

        log.info({ taskId: task.taskId, completedCount, failedCount }, 'Report generated');
        return JSON.stringify(report);
    }
}
