import { Router, Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../data-source';
import { WorkflowService } from '../services/WorkflowService';

const router = Router();
const service = new WorkflowService(AppDataSource);

/**
 * GET /workflow/:id/status
 *
 * 200 – counters
 * 404 – workflow not found
 */
router.get('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).json(await service.getStatus(req.params.id));
    } catch (err) {
        next(err);
    }
});

/**
 * GET /workflow/:id/results
 *
 * 200 – workflow completed; parsed finalResult
 * 400 – workflow exists but has not yet completed (any partial finalResult is surfaced)
 * 404 – workflow not found
 */
router.get('/:id/results', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await service.getResults(req.params.id);

        // Strip the discriminator before sending to the client
        const { completed, ...body } = result;
        res.status(completed ? 200 : 400).json(body);
    } catch (err) {
        next(err);
    }
});

export default router;
