import { Router, Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../data-source';
import { Workflow } from '../models/Workflow';
import { Task } from '../models/Task';
import { TaskStatus } from '../domain/TaskStatus';
import { WorkflowStatus } from '../domain/WorkflowStatus';
import { safeParse } from '../utils/safeParse';
import { HttpError } from '../errors/HttpError';

const router = Router();

/**
 * GET /workflow/:id/status
 *
 * Returns the current status of a workflow plus task-completion counters.
 *
 * 200 – workflow found
 * 404 – workflow not found
 */
router.get('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workflowRepository = AppDataSource.getRepository(Workflow);
        const taskRepository = AppDataSource.getRepository(Task);

        const workflow = await workflowRepository.findOne({
            where: { workflowId: req.params.id },
        });

        if (!workflow) {
            throw new HttpError(404, `Workflow ${req.params.id} not found`);
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
    } catch (err) {
        next(err);
    }
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
router.get('/:id/results', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const workflowRepository = AppDataSource.getRepository(Workflow);

        const workflow = await workflowRepository.findOne({
            where: { workflowId: req.params.id },
        });

        if (!workflow) {
            throw new HttpError(404, `Workflow ${req.params.id} not found`);
        }

        if (workflow.status !== WorkflowStatus.Completed) {
            // Richer body than HttpError supports — explicit response.
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
    } catch (err) {
        next(err);
    }
});

export default router;
