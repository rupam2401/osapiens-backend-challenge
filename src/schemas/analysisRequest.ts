/**
 * Request schema for POST /analysis.
 *
 * Accepts either a GeoJSON Feature whose geometry is Polygon/MultiPolygon,
 * or a bare Polygon/MultiPolygon geometry. The downstream job
 * (PolygonAreaJob) already does deeper structural validation; this layer
 * just rejects obviously malformed payloads at the API boundary so they
 * never reach the worker.
 */
import { z } from 'zod';

const geometrySchema = z.object({
    type: z.enum(['Polygon', 'MultiPolygon']),
    coordinates: z.array(z.unknown()),
});

const featureSchema = z.object({
    type: z.literal('Feature'),
    geometry: geometrySchema,
    properties: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const analysisRequestSchema = z.object({
    clientId: z.string().min(1, 'clientId is required'),
    geoJson: z.union([featureSchema, geometrySchema]),
});

export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
