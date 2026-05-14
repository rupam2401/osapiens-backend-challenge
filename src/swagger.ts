import { SwaggerUiOptions } from 'swagger-ui-express';

export const swaggerOptions: SwaggerUiOptions = {
    customCss: `
        .swagger-ui .topbar { background-color: #1a1a2e; }
        .swagger-ui .topbar-wrapper .link { visibility: hidden; }
        .swagger-ui .topbar-wrapper::before {
            content: 'osapiens Backend API';
            color: #e0e0e0;
            font-size: 18px;
            font-weight: bold;
            padding: 10px;
        }
        .swagger-ui .info .title { color: #1a1a2e; }
        .swagger-ui .btn.execute { background-color: #0f3460; border-color: #0f3460; }
        .copy-to-clipboard { display: none; }
    `,
    customSiteTitle: 'osapiens API Playground',
};

export const swaggerSpec = {
    openapi: '3.0.3',
    info: {
        title: 'osapiens Backend API',
        version: '1.0.0',
        description: `
## How to use this playground

1. **Create a workflow** — use \`POST /analysis\` below. Pick one of the polygon examples.
2. **Copy the \`workflowId\`** from the response.
3. **Paste it** into \`GET /workflow/{id}/status\` or \`GET /workflow/{id}/results\`.
4. The worker runs every **5 seconds**; a 3-step workflow completes in ~15–20 s.

> Tip: expand a request, click **Try it out**, then **Execute**.
        `.trim(),
        contact: { name: 'osapiens dev team' },
    },
    tags: [{ name: 'Workflows', description: 'Create and inspect async processing workflows' }],
    paths: {
        '/analysis': {
            post: {
                tags: ['Workflows'],
                summary: 'Create a workflow',
                description: `
Kicks off a 3-step pipeline:
1. **polygonArea** — calculates the area of your polygon (m²)
2. **analysis** — finds which country the polygon is in
3. **reportGeneration** — aggregates the results of steps 1 & 2

Copy the **workflowId** from the response and use it in the status / results endpoints.
                `.trim(),
                operationId: 'createWorkflow',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['clientId', 'geoJson'],
                                properties: {
                                    clientId: {
                                        type: 'string',
                                        description:
                                            'Identifier for the client submitting the request',
                                        example: 'reviewer-1',
                                    },
                                    geoJson: {
                                        type: 'object',
                                        description:
                                            'GeoJSON Feature or Polygon geometry to analyse',
                                    },
                                },
                            },
                            examples: {
                                brazil: {
                                    summary: '🇧🇷 Brazil — Amazon basin polygon',
                                    value: {
                                        clientId: 'reviewer-brazil',
                                        geoJson: {
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
                                        },
                                    },
                                },
                                germany: {
                                    summary: '🇩🇪 Germany — Berlin area polygon',
                                    value: {
                                        clientId: 'reviewer-germany',
                                        geoJson: {
                                            type: 'Feature',
                                            geometry: {
                                                type: 'Polygon',
                                                coordinates: [
                                                    [
                                                        [13.2884, 52.4539],
                                                        [13.2884, 52.5759],
                                                        [13.5155, 52.5759],
                                                        [13.5155, 52.4539],
                                                        [13.2884, 52.4539],
                                                    ],
                                                ],
                                            },
                                            properties: {},
                                        },
                                    },
                                },
                                usa: {
                                    summary: '🇺🇸 USA — Colorado (rectangular state outline)',
                                    value: {
                                        clientId: 'reviewer-usa',
                                        geoJson: {
                                            type: 'Feature',
                                            geometry: {
                                                type: 'Polygon',
                                                coordinates: [
                                                    [
                                                        [-109.0452, 37.0004],
                                                        [-109.0452, 41.0006],
                                                        [-102.0424, 41.0006],
                                                        [-102.0424, 37.0004],
                                                        [-109.0452, 37.0004],
                                                    ],
                                                ],
                                            },
                                            properties: {},
                                        },
                                    },
                                },
                                australia: {
                                    summary: '🇦🇺 Australia — Northern Territory polygon',
                                    value: {
                                        clientId: 'reviewer-australia',
                                        geoJson: {
                                            type: 'Feature',
                                            geometry: {
                                                type: 'Polygon',
                                                coordinates: [
                                                    [
                                                        [130.8, -12.5],
                                                        [130.8, -13.2],
                                                        [131.6, -13.2],
                                                        [131.6, -12.5],
                                                        [130.8, -12.5],
                                                    ],
                                                ],
                                            },
                                            properties: {},
                                        },
                                    },
                                },
                                invalid_for_demo: {
                                    summary: '⚠️ Error demo — Point geometry (will fail step 1)',
                                    description:
                                        'Use this to see how a failing task propagates through the workflow.',
                                    value: {
                                        clientId: 'reviewer-error-demo',
                                        geoJson: {
                                            type: 'Feature',
                                            geometry: {
                                                type: 'Point',
                                                coordinates: [13.4, 52.5],
                                            },
                                            properties: {},
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    202: {
                        description:
                            'Workflow created — copy the **workflowId** for the next calls',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        workflowId: {
                                            type: 'string',
                                            format: 'uuid',
                                            description:
                                                '⬅️ Copy this and paste it into the status / results endpoints',
                                            example: '3433c76d-f226-4c91-afb5-7dfc7accab24',
                                        },
                                        message: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    500: { description: 'Server error (e.g. YAML parse failure)' },
                },
            },
        },

        '/workflow/{id}/status': {
            get: {
                tags: ['Workflows'],
                summary: 'Get workflow status',
                description:
                    'Returns the current status and how many tasks have completed. Poll this until `completedTasks === totalTasks`.',
                operationId: 'getWorkflowStatus',
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'The `workflowId` returned by `POST /analysis`',
                        schema: { type: 'string', format: 'uuid' },
                        example: '3433c76d-f226-4c91-afb5-7dfc7accab24',
                    },
                ],
                responses: {
                    200: {
                        description: 'Workflow found',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        workflowId: { type: 'string', format: 'uuid' },
                                        status: {
                                            type: 'string',
                                            enum: ['initial', 'in_progress', 'completed', 'failed'],
                                        },
                                        completedTasks: { type: 'integer', example: 2 },
                                        totalTasks: { type: 'integer', example: 3 },
                                    },
                                },
                                examples: {
                                    in_progress: {
                                        summary: 'Still running',
                                        value: {
                                            workflowId: '3433c76d-f226-4c91-afb5-7dfc7accab24',
                                            status: 'in_progress',
                                            completedTasks: 1,
                                            totalTasks: 3,
                                        },
                                    },
                                    completed: {
                                        summary: 'Done ✅',
                                        value: {
                                            workflowId: '3433c76d-f226-4c91-afb5-7dfc7accab24',
                                            status: 'completed',
                                            completedTasks: 3,
                                            totalTasks: 3,
                                        },
                                    },
                                    failed: {
                                        summary: 'Failed ❌',
                                        value: {
                                            workflowId: '3433c76d-f226-4c91-afb5-7dfc7accab24',
                                            status: 'failed',
                                            completedTasks: 0,
                                            totalTasks: 3,
                                        },
                                    },
                                },
                            },
                        },
                    },
                    404: {
                        description: 'Workflow not found',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: { message: { type: 'string' } },
                                },
                                example: {
                                    message:
                                        'Workflow 3433c76d-f226-4c91-afb5-7dfc7accab24 not found',
                                },
                            },
                        },
                    },
                },
            },
        },

        '/workflow/{id}/results': {
            get: {
                tags: ['Workflows'],
                summary: 'Get workflow results',
                description: `
Returns the aggregated \`finalResult\` once the workflow is **completed**.

- **200** — workflow completed; full \`finalResult\` with per-task outputs returned
- **400** — workflow not yet completed (try again, or it failed — check status first)
- **404** — workflow not found
                `.trim(),
                operationId: 'getWorkflowResults',
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'The `workflowId` returned by `POST /analysis`',
                        schema: { type: 'string', format: 'uuid' },
                        example: '3433c76d-f226-4c91-afb5-7dfc7accab24',
                    },
                ],
                responses: {
                    200: {
                        description: 'Workflow completed — full results returned',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        workflowId: { type: 'string', format: 'uuid' },
                                        status: { type: 'string', enum: ['completed'] },
                                        finalResult: {
                                            type: 'object',
                                            properties: {
                                                workflowId: { type: 'string' },
                                                status: { type: 'string' },
                                                tasks: {
                                                    type: 'array',
                                                    items: {
                                                        type: 'object',
                                                        properties: {
                                                            taskId: { type: 'string' },
                                                            type: { type: 'string' },
                                                            stepNumber: { type: 'integer' },
                                                            status: { type: 'string' },
                                                            output: {
                                                                description:
                                                                    'Job-specific output (object or string)',
                                                            },
                                                            error: {
                                                                type: 'string',
                                                                nullable: true,
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                                example: {
                                    workflowId: '3433c76d-f226-4c91-afb5-7dfc7accab24',
                                    status: 'completed',
                                    finalResult: {
                                        workflowId: '3433c76d-f226-4c91-afb5-7dfc7accab24',
                                        status: 'completed',
                                        tasks: [
                                            {
                                                taskId: 'aaa-111',
                                                type: 'polygonArea',
                                                stepNumber: 1,
                                                status: 'completed',
                                                output: { areaSqMeters: 8359776.6 },
                                                error: null,
                                            },
                                            {
                                                taskId: 'bbb-222',
                                                type: 'analysis',
                                                stepNumber: 2,
                                                status: 'completed',
                                                output: 'Brazil',
                                                error: null,
                                            },
                                            {
                                                taskId: 'ccc-333',
                                                type: 'reportGeneration',
                                                stepNumber: 3,
                                                status: 'completed',
                                                output: {
                                                    finalReport:
                                                        'All 2 preceding tasks completed successfully.',
                                                },
                                                error: null,
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Workflow not yet completed',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string' },
                                        workflowId: { type: 'string' },
                                        status: { type: 'string' },
                                        finalResult: { nullable: true },
                                    },
                                },
                                example: {
                                    message:
                                        'Workflow is not yet completed (current status: in_progress)',
                                    workflowId: '3433c76d-f226-4c91-afb5-7dfc7accab24',
                                    status: 'in_progress',
                                    finalResult: null,
                                },
                            },
                        },
                    },
                    404: {
                        description: 'Workflow not found',
                        content: {
                            'application/json': {
                                example: {
                                    message:
                                        'Workflow 3433c76d-f226-4c91-afb5-7dfc7accab24 not found',
                                },
                            },
                        },
                    },
                },
            },
        },
    },
};
