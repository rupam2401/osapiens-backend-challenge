# osapiens-backend

Async workflow engine built with **TypeScript**, **Express 5**, and **TypeORM**. A single HTTP request creates a multi-step processing pipeline; each step runs as a background job and results can be polled via REST endpoints.

---

## Requirements

The only supported runtime is the Docker container produced by the included `Dockerfile`. Both CI and production target `node:24-alpine` — code is not tested against any other Node version or OS.

| Tool | Used for | Required? |
|---|---|---|
| **Docker** | Running the service (`make up`) and the CI smoke test | **Yes** |
| **GNU Make** | Convenience targets (`make up`, `make demo`, …) | Recommended |
| **Node.js 24.x + npm** | Local development only (`npm run dev`, `npm test`) | Optional |

Local installs of Node are a convenience for the inner dev loop; they are not a supported deployment target. The `package.json` `engines` field pins Node 24.x to match the Dockerfile.

---

## Quick start

```bash
make up                            # build the image and start the container
make open                          # open Swagger at http://localhost:3000/api-docs
```

That's the whole supported path. The container exposes the API on port 3000 and is the only environment exercised by CI.

### Try an end-to-end demo

```bash
make demo                          # Brazil polygon — runs the 3-task pipeline (~20s)
make demo-de                       # Berlin polygon
make demo-fail                     # Invalid geometry — exercises the failure cascade
make wf WID=<workflowId>           # Re-poll status + results for a known workflow
```

### Local development (optional, no Docker)

Useful for the inner edit/test loop only — not a supported deployment path.

```bash
npm install --registry https://registry.npmjs.org
npm run dev                        # ts-node + nodemon, hot-reload
npm test                           # 25 tests across 6 suites
```

> `--registry` is required because the project's `.npmrc` points to a private CodeArtifact registry with an expired token. All packages resolve from the public registry.

---

## Tech stack

| Layer | Library / version |
|---|---|
| Runtime | Node.js 24 (Docker image: `node:24-alpine`) |
| Language | TypeScript 6 |
| HTTP framework | Express 5 |
| ORM | TypeORM 0.3 |
| Database | `better-sqlite3` (native SQLite; musl prebuild used in Alpine) |
| Geospatial | `@turf/turf` 7 |
| Validation | `zod` |
| Logging | `pino` + `pino-http` |
| Tests | Jest 30 + ts-jest + supertest |
| Lint / format | ESLint 9 (flat config) + Prettier |

---

## Environment variables

Copy `.env.example` to `.env` to override defaults; all settings are optional.

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | `development` / `test` / `production` — toggles log formatting |
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `data/database.sqlite` | SQLite file path (use `:memory:` for ephemeral) |
| `WORKER_POLL_MS` | `5000` | How often the background worker polls for queued tasks |
| `LOG_LEVEL` | `info` | pino level: `trace` / `debug` / `info` / `warn` / `error` / `fatal` |
| `BODY_LIMIT` | `256kb` | Maximum accepted JSON body size |

Production deployments emit ndjson logs on stdout; local dev pretty-prints via `pino-pretty`. Tests silence logs by default.

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

NPM scripts: `npm run lint`, `npm run lint:fix`, `npm run format`, `npm run format:check`, `npm run typecheck`, `npm test`.

---

## Project structure

```
├── Dockerfile              # Two-stage build: compile TS → lean Alpine runtime
├── Makefile                # All project commands
├── eslint.config.js        # ESLint 9 flat config
├── .prettierrc             # 4-space, single-quote, 100 col
├── .env.example            # Documented env vars (copy to .env)
├── .github/workflows/ci.yml  # node:24-alpine: typecheck/lint/test + Docker build + /health probe
├── src/
│   ├── config.ts           # Typed env-derived config object
│   ├── data-source.ts      # TypeORM DataSource (better-sqlite3)
│   ├── index.ts            # HTTP bootstrap + graceful shutdown
│   ├── logger.ts           # pino base logger
│   ├── swagger.ts          # OpenAPI 3.0 spec + Swagger UI config
│   ├── domain/
│   │   ├── TaskStatus.ts
│   │   └── WorkflowStatus.ts
│   ├── models/
│   │   ├── Task.ts         # output, dependsOnTaskId, status, …
│   │   └── Workflow.ts     # finalResult, status
│   ├── jobs/
│   │   ├── Job.ts          # Job interface + JobContext type
│   │   ├── JobFactory.ts   # taskType → Job registry
│   │   ├── DataAnalysisJob.ts       # Finds which country a polygon is in
│   │   ├── EmailNotificationJob.ts  # Stub notification (500 ms delay)
│   │   ├── PolygonAreaJob.ts        # Calculates area via @turf/area
│   │   └── ReportGenerationJob.ts   # Aggregates preceding task outputs
│   ├── workflows/
│   │   ├── WorkflowFactory.ts      # Parses YAML → Workflow + Task entities
│   │   ├── example_workflow.yml    # polygonArea → analysis → reportGeneration
│   │   └── report_workflow.yml     # polygonArea → notification → reportGeneration
│   ├── runner/
│   │   └── TaskRunner.ts   # Execution, state transitions, workflow reconciliation
│   ├── worker/
│   │   └── taskWorker.ts   # AbortSignal-driven polling loop
│   ├── services/
│   │   └── WorkflowService.ts      # createFromAnalysis / getStatus / getResults
│   ├── routes/
│   │   ├── analysisRoutes.ts   # POST /analysis (zod-validated)
│   │   ├── workflowRoutes.ts   # GET /workflow/:id/status + /results
│   │   ├── healthRoutes.ts     # GET /health
│   │   └── defaultRoute.ts     # README rendered as HTML
│   ├── schemas/
│   │   └── analysisRequest.ts  # zod schema for POST /analysis
│   ├── middleware/
│   │   └── errorHandler.ts     # ZodError + HttpError + fallthrough 500
│   ├── errors/
│   │   └── HttpError.ts        # status-carrying Error
│   └── utils/
│       └── safeParse.ts        # Shared JSON.parse helper
└── __tests__/              # Jest integration tests (25 tests, 6 suites)
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

Response `400` (malformed body):
```json
{
  "message": "Validation failed",
  "details": [
    { "path": "clientId", "message": "clientId is required" }
  ]
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
        "status": "completed", "output": { "country": "Brazil" }, "error": null
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

### GET /health

Liveness / readiness probe. Pings the database with `SELECT 1`.

```bash
curl http://localhost:3000/health
```

```json
{ "status": "ok" }
```

| Code | Meaning |
|---|---|
| 200 | DB responsive |
| 503 | DB query failed |

Used by the Docker `HEALTHCHECK`.

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
| `analysis` | `{ "country": "<name>" }` or `{ "country": null }` |
| `notification` | `{}` — stub, 500 ms delay |
| `reportGeneration` | `{ "workflowId", "tasks": [...], "finalReport": "..." }` |

### Dependency rules

- A task only starts once its `dependsOn` step is `completed`.
- If a dependency **fails**, the dependent task is cascade-failed immediately.
- Tasks are always executed in ascending `stepNumber` order.

---

## Architecture notes

**Task lifecycle:** `queued` → `in_progress` → `completed` / `failed`

**Worker loop:** polls every `WORKER_POLL_MS` (default 5 s), picks the lowest-eligible `stepNumber` queued task, runs it via `TaskRunner`. The loop accepts an `AbortSignal` so `SIGTERM`/`SIGINT` drains it cleanly.

**Workflow reconciliation:** after every task reaches a terminal state, `TaskRunner.reconcileWorkflow` re-evaluates the overall workflow status and — on the first terminal state — writes the aggregated `finalResult` to the `Workflow` entity. This runs in a `finally` block so it always executes, even when a task fails.

**Graceful shutdown:** on `SIGTERM`/`SIGINT`, `index.ts` closes the HTTP server, aborts the worker, waits up to 10 s for the in-flight task to finish, then closes the DataSource and exits 0.

**Database:** TypeORM's `better-sqlite3` driver — a fast native SQLite binding. The Alpine container pulls the `linux-musl-x64` prebuild at `npm ci`, so no compiler is required. The DB lives at `data/database.sqlite`; in Docker the `data/` directory is backed by the `osapiens-data` named volume.

---

## Testing

```bash
make test
# or
npm test
```

25 tests across 6 suites:

| Suite | Covers |
|---|---|
| `polygonAreaJob.test.ts` | Valid polygon, invalid JSON, non-polygon geometry, bare MultiPolygon |
| `workflowFactory.test.ts` | YAML parsing, `dependsOnTaskId` wiring, bad `dependsOn` reference (temp YAML in `os.tmpdir`) |
| `taskRunner.test.ts` | Completed/failed transitions, `output` persistence, `finalResult` aggregation, dependency cascade |
| `workflowRoutes.test.ts` | All 404 / 400 / 200 paths for `/status` and `/results` (via real `errorHandler`) |
| `analysisRoutes.test.ts` | zod 400 paths: empty body, missing `clientId`, Point geometry, valid 202 |
| `healthRoute.test.ts` | 200 happy path against `SELECT 1` probe |

CI runs `typecheck` → `lint` → `test` inside `node:24-alpine` (mirroring the Dockerfile), and in parallel builds the real image and waits for `GET /health` to return 200.

---

## Docker details

The image uses a **two-stage build**:

1. **Builder** — installs all deps, compiles TypeScript with `tsc`
2. **Runtime** — installs production deps only, copies compiled JS + runtime assets

The container runs as the non-root `node` user. Data persists in the `osapiens-data` Docker named volume. `HEALTHCHECK` hits `/health` (DB-aware) rather than just the HTTP server.
