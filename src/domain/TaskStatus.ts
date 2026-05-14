/**
 * Lifecycle states of a Task. A task starts in `Queued`, moves to `InProgress`
 * while running, and ends in `Completed` or `Failed` (both terminal).
 */
export enum TaskStatus {
    Queued = 'queued',
    InProgress = 'in_progress',
    Completed = 'completed',
    Failed = 'failed',
}
