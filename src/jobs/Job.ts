import { Task } from '../models/Task';

/**
 * Context passed from the TaskRunner to a job, carrying the output of the
 * task this one depends on (if any). Jobs that don't use dependencies can
 * safely ignore this parameter.
 */
export interface JobContext {
    /** Parsed output of the dependency task, or the raw string if JSON.parse fails. */
    dependencyOutput?: unknown;
}

export interface Job {
    run(task: Task, context?: JobContext): Promise<any>;
}
