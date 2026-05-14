import { Job, JobContext } from './Job';
import { Task } from '../models/Task';
import booleanWithin from '@turf/boolean-within';
import { Feature, Polygon } from 'geojson';
import countryMapping from '../data/world_data.json';
import { logger } from '../logger';

const log = logger.child({ module: 'DataAnalysisJob' });

export class DataAnalysisJob implements Job {
    async run(task: Task, _context?: JobContext): Promise<string> {
        log.debug({ taskId: task.taskId }, 'Running data analysis');

        const inputGeometry: Feature<Polygon> = JSON.parse(task.geoJson);

        for (const countryFeature of countryMapping.features) {
            if (countryFeature.geometry.type === 'Polygon' || countryFeature.geometry.type === 'MultiPolygon') {
                const isWithin = booleanWithin(inputGeometry, countryFeature as Feature<Polygon>);
                if (isWithin) {
                    const country = countryFeature.properties?.name;
                    log.info({ taskId: task.taskId, country }, 'Polygon located within country');
                    return country;
                }
            }
        }
        log.info({ taskId: task.taskId }, 'No containing country found');
        return 'No country found';
    }
}