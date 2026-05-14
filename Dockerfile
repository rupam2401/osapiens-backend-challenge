# =========================================================
# Stage 1 — Build: compile TypeScript to JavaScript
# =========================================================
FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npx tsc

# =========================================================
# Stage 2 — Runtime: lean image, production deps only
# =========================================================
FROM node:24-alpine AS runtime
WORKDIR /app

# Production dependencies only (no devDeps)
COPY package*.json ./
RUN npm ci --omit=dev

# Compiled JavaScript from the builder stage
COPY --from=builder /app/dist ./dist

# world_data.json — imported via require() by DataAnalysisJob at runtime
COPY src/data ./dist/data

# YAML workflow definitions — read via fs.readFileSync by WorkflowFactory
COPY src/workflows ./dist/workflows

# README rendered as HTML by the default route
COPY README.md ./README.md

# Static assets served by the default route
COPY public ./public

# Writable directory for the sql.js database file
RUN mkdir -p data && chown node:node data

# Run as non-root
USER node

EXPOSE 3000

# Health-check: hit the dedicated /health endpoint (pings the DB)
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:3000/health > /dev/null || exit 1

CMD ["node", "dist/index.js"]
