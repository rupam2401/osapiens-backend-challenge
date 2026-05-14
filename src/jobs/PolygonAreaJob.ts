import area from '@turf/area';
import { Job, JobContext } from './Job';
import { Task } from '../models/Task';
import { Feature, Polygon, MultiPolygon, GeoJSON } from 'geojson';
import { logger } from '../logger';

const log = logger.child({ module: 'PolygonAreaJob' });

export class PolygonAreaJob implements Job {
    async run(task: Task, _context?: JobContext): Promise<string> {
        log.debug({ taskId: task.taskId }, 'Calculating polygon area');

        let geom: GeoJSON;
        try {
            geom = JSON.parse(task.geoJson);
        } catch {
            throw new Error('Invalid GeoJSON: could not parse geoJson field');
        }

        // Accept Feature<Polygon|MultiPolygon>, bare Polygon/MultiPolygon geometry, or FeatureCollection
        const type = (geom as any).type as string;
        const validTypes = ['Polygon', 'MultiPolygon', 'Feature', 'FeatureCollection'];
        if (!validTypes.includes(type)) {
            throw new Error(
                `Invalid GeoJSON: expected Polygon, MultiPolygon, Feature or FeatureCollection but got "${type}"`,
            );
        }

        // Narrower check: if it's a Feature, the geometry must be Polygon or MultiPolygon
        if (type === 'Feature') {
            const geoType = (geom as Feature).geometry?.type;
            if (geoType !== 'Polygon' && geoType !== 'MultiPolygon') {
                throw new Error(
                    `Invalid GeoJSON: Feature geometry must be Polygon or MultiPolygon but got "${geoType}"`,
                );
            }
        }

        const areaSqMeters = area(geom as Feature<Polygon | MultiPolygon>);
        log.info({ taskId: task.taskId, areaSqMeters }, 'Polygon area computed');

        return JSON.stringify({ areaSqMeters });
    }
}
