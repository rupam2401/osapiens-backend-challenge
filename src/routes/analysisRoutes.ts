import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { analysisRequestSchema } from '../schemas/analysisRequest';
import { WorkflowService } from '../services/WorkflowService';

const router = Router();
const service = new WorkflowService(AppDataSource);

router.post('/', async (req, res, next) => {
    try {
        const { clientId, geoJson } = analysisRequestSchema.parse(req.body);
        const { workflowId } = await service.createFromAnalysis(clientId, geoJson);

        res.status(202).json({
            workflowId,
            message: 'Workflow created and tasks queued from YAML definition.',
        });
    } catch (err) {
        next(err);
    }
});

export default router;
