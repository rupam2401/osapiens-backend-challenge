# osapiens-backend

Async workflow engine built with **TypeScript**, **Express 5**, and **TypeORM**. A single HTTP request creates a multi-step processing pipeline; each step runs as a background job and results can be polled via REST endpoints.

---

## Setup & runthrough

**1. Start the container**

```bash
make up
```

**2. Open the Swagger playground**

```bash
make open
```

Or navigate to `http://localhost:3000/api-docs` directly.

**3. (Optional) Run a full end-to-end demo**

```bash
make demo
```

This creates a Brazil polygon workflow, waits ~20 s for all 3 tasks to complete, then prints the status and aggregated results. You can also run `make demo-de` (Berlin) or `make demo-fail` (error cascade demo).

To inspect a specific workflow you already created:

```bash
make wf WID=<workflowId>
```

---

## Tech stack

| Layer | Library / version |
|---|---|
| Runtime | Node.js 24 |
| Language | TypeScript 6 |
| HTTP framework | Express 5 |
| ORM | TypeORM 0.3 |
| Database | sql.js (WebAssembly SQLite — no native compilation required) |
| Geospatial | @turf/turf 7 |
| Tests | Jest 30 + ts-jest + supertest |

---

## Quick start

### Docker (recommended)

```bash
make up
```

That's it. The image builds and the container starts. Open the interactive playground at:

**http://localhost:3000/api-docs**

### Local dev (no Docker)

```bash
npm install --registry https://registry.npmjs.org
npm start
```

> `--registry` is required because the project's `.npmrc` points to a private CodeArtifact registry with an expired token. All packages resolve from the public registry.

---

## Make targets

| Target | What it does |
|---|---|
| `make up` | Build image + start container |
| `make down` | Stop and remove the container |
| `make restart` | `down` + `up` |
| `make build` | Build (or rebuild) the Docker image |
| `make rebuild` | Force-rebuild with `--no-cache` |
| `make logs` | Follow container logs |
| `make shell` | Open a shell inside the running container |
| `make status` | Show container name, status and port |
| `make clean` | Remove container, image and data volume |
| `make dev` | Start local dev server with hot-reload (ts-node) |
| `make test` | Run the Jest test suite locally |
| `make typecheck` | Run `tsc --noEmit` only |
| `make demo` | End-to-end demo — Brazil polygon |
| `make demo-de` | End-to-end demo — Berlin polygon |
| `make demo-fail` | End-to-end demo — invalid geometry (shows error cascade) |
| `make open` | Open Swagger UI in the browser |
| `make wf WID=<id>` | Print status + results for a workflow ID |

---

## Project structure

```
├── Dockerfile              # Two-stage build: compile TS → lean Alpine runtime
├── Makefile                # All project commands
├── src/
│   ├── models/
│   │   ├── Task.ts         # Task entity (output, dependsOnTaskId, status, …)
│   │   ├── Workflow.ts     # Workflow entity (finalResult, status)
│   │   └── Result.ts       # Legacy result store
│   ├── jobs/
│   │   ├── Job.ts          # Job interface + JobContext type
│   │   ├── JobFactory.ts   # taskType → Job registry
│   │   ├── TaskRunner.ts   # Execution, state transitions, workflow reconciliation
│   │   ├── DataAnalysisJob.ts    # Finds which country a polygon is in
│   │   ├── EmailNotificationJob.ts # Stub notification (500 ms delay)
│   │   ├── PolygonAreaJob.ts     # Calculates area via @turf/area
│   │   └── ReportGenerationJob.ts # Aggregates preceding task outputs
│   ├── workflows/
│   │   ├── WorkflowFactory.ts    # Parses YAML → Workflow + Task entities
│   │   ├── example_workflow.yml  # polygonArea → analysis → reportGeneration
│   │   └── report_workflow.yml   # polygonArea → notification → reportGeneration
│   ├── workers/
│   │   └── taskWorker.ts   # Polls every 5 s; stepNumber order + dependency gating
│   ├── routes/
│   │   ├── analysisRoutes.ts   # POST /analysis
│   │   └── workflowRoutes.ts   # GET /workflow/:id/status  +  /results
│   ├── swagger.ts          # OpenAPI 3.0 spec + Swagger UI config
│   ├── data-source.ts      # TypeORM DataSource (sql.js driver)
│   └── index.ts            # Server + worker bootstrap
├── __tests__/              # Jest integration tests (20 tests, 4 suites)
└── INSTRUCTIONS.md         # Original coding challenge brief
```

---

## API

### POST /analysis — create a workflow

Queues a 3-step pipeline:

| Step | Job | What it does |
|---|---|---|
| 1 | `polygonArea` | Calculates area of the polygon in m² |
| 2 | `analysis` | Finds which country the polygon lies within |
| 3 | `reportGeneration` | Aggregates outputs of steps 1 & 2 |

```bash
curl -X POST http://localhost:3000/analysis \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "demo",
    "geoJson": {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-63.6249,-10.3111], [-63.6249,-10.3679],
          [-63.6128,-10.3679], [-63.6128,-10.3111],
          [-63.6249,-10.3111]
        ]]
      },
      "properties": {}
    }
  }'
```

Response `202`:
```json
{
  "workflowId": "3433c76d-f226-4c91-afb5-7dfc7accab24",
  "message": "Workflow created and tasks queued from YAML definition."
}
```

---

### GET /workflow/:id/status

Poll this until `completedTasks === totalTasks`.

```bash
curl http://localhost:3000/workflow/<workflowId>/status
```

```json
{
  "workflowId": "3433c76d-...",
  "status": "in_progress",
  "completedTasks": 1,
  "totalTasks": 3
}
```

| Code | Meaning |
|---|---|
| 200 | Workflow found |
| 404 | Workflow not found |

---

### GET /workflow/:id/results

Call once `status` is `completed`.

```bash
curl http://localhost:3000/workflow/<workflowId>/results
```

Response `200`:
```json
{
  "workflowId": "3433c76d-...",
  "status": "completed",
  "finalResult": {
    "workflowId": "3433c76d-...",
    "status": "completed",
    "tasks": [
      {
        "taskId": "...", "type": "polygonArea", "stepNumber": 1,
        "status": "completed", "output": { "areaSqMeters": 8363324.27 }, "error": null
      },
      {
        "taskId": "...", "type": "analysis", "stepNumber": 2,
        "status": "completed", "output": "Brazil", "error": null
      },
      {
        "taskId": "...", "type": "reportGeneration", "stepNumber": 3,
        "status": "completed",
        "output": { "finalReport": "All 2 preceding tasks completed successfully." },
        "error": null
      }
    ]
  }
}
```

| Code | Meaning |
|---|---|
| 200 | Workflow completed; full `finalResult` returned |
| 400 | Not yet completed (or failed) — `status` included in body |
| 404 | Workflow not found |

---

## Workflow YAML format

Workflows are defined in YAML files under `src/workflows/`.

```yaml
name: "my_workflow"
steps:
  - taskType: "polygonArea"
    stepNumber: 1

  - taskType: "analysis"
    stepNumber: 2
    dependsOn: 1          # waits for stepNumber 1 to complete

  - taskType: "reportGeneration"
    stepNumber: 3
    dependsOn: 2          # waits for stepNumber 2 to complete
```

### Available job types

| `taskType` | Output |
|---|---|
| `polygonArea` | `{ "areaSqMeters": <number> }` — throws on non-polygon geometry |
| `analysis` | `"<country name>"` — or `"No country found"` |
| `notification` | `{}` — stub, 500 ms delay |
| `reportGeneration` | `{ "workflowId", "tasks": [...], "finalReport": "..." }` |

### Dependency rules

- A task only starts once its `dependsOn` step is `completed`.
- If a dependency **fails**, the dependent task is cascade-failed immediately.
- Tasks are always executed in ascending `stepNumber` order.

---

## Architecture notes

**Task lifecycle:** `queued` → `in_progress` → `completed` / `failed`

**Worker loop:** polls every 5 seconds, picks the lowest-eligible `stepNumber` queued task, runs it via `TaskRunner`.

**Workflow reconciliation:** after every task reaches a terminal state, `TaskRunner.reconcileWorkflow` re-evaluates the overall workflow status and — on the first terminal state — writes the aggregated `finalResult` to the `Workflow` entity. This runs in a `finally` block so it always executes, even when a task fails.

**Database:** TypeORM's `sqljs` driver (WebAssembly SQLite, no native compilation). Persisted to `data/database.sqlite` via `autoSave: true`. In Docker, the `data/` directory is backed by the `osapiens-data` named volume.

---

## Testing

```bash
make test
# or
npm test
```

20 tests across 4 suites:

| Suite | Covers |
|---|---|
| `polygonAreaJob.test.ts` | Valid polygon, invalid JSON, non-polygon geometry, bare MultiPolygon |
| `workflowFactory.test.ts` | YAML parsing, `dependsOnTaskId` wiring, bad `dependsOn` reference |
| `taskRunner.test.ts` | Completed/failed transitions, `output` persistence, `finalResult` aggregation, dependency cascade |
| `workflowRoutes.test.ts` | All 404 / 400 / 200 paths for `/status` and `/results` |

---

## Docker details

The image uses a **two-stage build**:

1. **Builder** — installs all deps, compiles TypeScript with `tsc`
2. **Runtime** — installs production deps only, copies compiled JS + runtime assets

Image size: ~444 MB (Node 24 Alpine + production node_modules).

The container runs as the non-root `node` user. Data persists in the `osapiens-data` Docker named volume.

---

## Challenge instructions

The original coding challenge brief is in [`INSTRUCTIONS.md`](./INSTRUCTIONS.md).
