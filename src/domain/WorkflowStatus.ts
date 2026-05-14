/**
 * Lifecycle states of a Workflow.  A workflow is `Initial` until the worker
 * picks up its first task, `InProgress` while tasks are running, and
 * `Completed` or `Failed` once every task has reached a terminal state.
 */
export enum WorkflowStatus {
    Initial = 'initial',
    InProgress = 'in_progress',
    Completed = 'completed',
    Failed = 'failed',
}
