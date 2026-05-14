import { PolygonAreaJob } from '../src/jobs/PolygonAreaJob';
import { Task } from '../src/models/Task';
import { TaskStatus } from '../src/domain/TaskStatus';

/** Minimal Task stub — only the fields PolygonAreaJob reads */
function makeTask(geoJson: string): Task {
    const t = new Task();
    t.taskId = 'test-task-id';
    t.clientId = 'test-client';
    t.geoJson = geoJson;
    t.status = TaskStatus.Queued;
    t.taskType = 'polygonArea';
    t.stepNumber = 1;
    return t;
}

const VALID_POLYGON_GEOJSON = JSON.stringify({
    type: 'Feature',
    geometry: {
        type: 'Polygon',
        coordinates: [
            [
                [-63.6249, -10.3111],
                [-63.6249, -10.3679],
                [-63.6128, -10.3679],
                [-63.6128, -10.3111],
                [-63.6249, -10.3111],
            ],
        ],
    },
    properties: {},
});

describe('PolygonAreaJob', () => {
    const job = new PolygonAreaJob();

    it('returns a JSON string containing areaSqMeters for a valid polygon', async () => {
        const task = makeTask(VALID_POLYGON_GEOJSON);
        const result = await job.run(task);

        expect(typeof result).toBe('string');
        const parsed = JSON.parse(result);
        expect(parsed).toHaveProperty('areaSqMeters');
        expect(typeof parsed.areaSqMeters).toBe('number');
        expect(parsed.areaSqMeters).toBeGreaterThan(0);
    });

    it('throws for invalid (non-parseable) GeoJSON', async () => {
        const task = makeTask('this is not json');
        await expect(job.run(task)).rejects.toThrow(/invalid geojson/i);
    });

    it('throws for a Point geometry (not a polygon)', async () => {
        const task = makeTask(
            JSON.stringify({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [0, 0] },
                properties: {},
            })
        );
        await expect(job.run(task)).rejects.toThrow(/Polygon or MultiPolygon/i);
    });

    it('throws for an empty object GeoJSON', async () => {
        const task = makeTask(JSON.stringify({}));
        await expect(job.run(task)).rejects.toThrow();
    });

    it('accepts a bare MultiPolygon geometry without Feature wrapper', async () => {
        const task = makeTask(
            JSON.stringify({
                type: 'MultiPolygon',
                coordinates: [
                    [
                        [
                            [-63.6249, -10.3111],
                            [-63.6249, -10.3679],
                            [-63.6128, -10.3679],
                            [-63.6128, -10.3111],
                            [-63.6249, -10.3111],
                        ],
                    ],
                ],
            })
        );
        const result = await job.run(task);
        const parsed = JSON.parse(result);
        expect(parsed.areaSqMeters).toBeGreaterThan(0);
    });
});
