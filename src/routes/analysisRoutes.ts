import { Router } from 'express';
import path from 'path';
import { AppDataSource } from '../data-source';
import { WorkflowFactory } from '../workflows/WorkflowFactory';
import { analysisRequestSchema } from '../schemas/analysisRequest';

const router = Router();
const workflowFactory = new WorkflowFactory(AppDataSource);

router.post('/', async (req, res, next) => {
    try {
        const { clientId, geoJson } = analysisRequestSchema.parse(req.body);
        const workflowFile = path.join(__dirname, '../workflows/example_workflow.yml');

        const workflow = await workflowFactory.createWorkflowFromYAML(
            workflowFile,
            clientId,
            JSON.stringify(geoJson),
        );

        res.status(202).json({
            workflowId: workflow.workflowId,
            message: 'Workflow created and tasks queued from YAML definition.',
        });
    } catch (err) {
        next(err);
    }
});

export default router;
