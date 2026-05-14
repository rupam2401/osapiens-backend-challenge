import { Job, JobContext } from './Job';
import { Task } from '../models/Task';
import { logger } from '../logger';

const log = logger.child({ module: 'EmailNotificationJob' });

export class EmailNotificationJob implements Job {
    async run(task: Task, _context?: JobContext): Promise<void> {
        log.info({ taskId: task.taskId }, 'Sending email notification');
        // Perform notification work
        await new Promise((resolve) => setTimeout(resolve, 500));
        log.info({ taskId: task.taskId }, 'Email sent');
    }
}
