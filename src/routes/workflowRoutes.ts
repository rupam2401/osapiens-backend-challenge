import { Router, Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { Workflow } from '../models/Workflow';
import { Task } from '../models/Task';
import { TaskStatus } from '../domain/TaskStatus';
import { WorkflowStatus } from '../domain/WorkflowStatus';

const router = Router();

/** Attempt JSON.parse; fall back to the raw string on failure. */
function safeParse(value: string | null | undefined): unknown {
    if (value == null) return null;
    try { return JSON.parse(value); } catch { return value; }
}

/**
 * GET /workflow/:id/status
 *
 * Returns the current status of a workflow plus task-completion counters.
 *
 * 200 – workflow found
 * 404 – workflow not found
 */
router.get('/:id/status', async (req: Request, res: Response) => {
    const workflowRepository = AppDataSource.getRepository(Workflow);
    const taskRepository = AppDataSource.getRepository(Task);

    const workflow = await workflowRepository.findOne({
        where: { workflowId: req.params.id },
    });

    if (!workflow) {
        res.status(404).json({ message: `Workflow ${req.params.id} not found` });
        return;
    }

    const tasks = await taskRepository.find({
        where: { workflow: { workflowId: workflow.workflowId } },
    });

    const completedTasks = tasks.filter(t => t.status === TaskStatus.Completed).length;

    res.status(200).json({
        workflowId: workflow.workflowId,
        status: workflow.status,
        completedTasks,
        totalTasks: tasks.length,
    });
});

/**
 * GET /workflow/:id/results
 *
 * Returns the aggregated finalResult of a completed workflow.
 *
 * 200 – workflow completed; finalResult is returned parsed if it is valid JSON
 * 400 – workflow exists but has not yet completed (includes in_progress, initial, failed)
 * 404 – workflow not found
 */
router.get('/:id/results', async (req: Request, res: Response) => {
    const workflowRepository = AppDataSource.getRepository(Workflow);

    const workflow = await workflowRepository.findOne({
        where: { workflowId: req.params.id },
    });

    if (!workflow) {
        res.status(404).json({ message: `Workflow ${req.params.id} not found` });
        return;
    }

    if (workflow.status !== WorkflowStatus.Completed) {
        res.status(400).json({
            message: `Workflow is not yet completed (current status: ${workflow.status})`,
            workflowId: workflow.workflowId,
            status: workflow.status,
            // Surface any partial finalResult that may have been written on failure
            finalResult: workflow.finalResult ? safeParse(workflow.finalResult) : null,
        });
        return;
    }

    res.status(200).json({
        workflowId: workflow.workflowId,
        status: workflow.status,
        finalResult: safeParse(workflow.finalResult),
    });
});

export default router;
