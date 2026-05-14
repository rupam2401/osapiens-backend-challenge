IMAGE     := osapiens-backend
CONTAINER := osapiens-backend
PORT      := 3000
VOLUME    := osapiens-data

# ─── Colours ──────────────────────────────────────────────────────────────────
BOLD  := \033[1m
CYAN  := \033[36m
GREEN := \033[32m
YELLOW:= \033[33m
RESET := \033[0m

.DEFAULT_GOAL := help

# ─── Help ─────────────────────────────────────────────────────────────────────
.PHONY: help
help:
	@printf "\n$(BOLD)osapiens Backend$(RESET)\n\n"
	@printf "$(CYAN)Docker targets$(RESET)\n"
	@printf "  $(BOLD)make build$(RESET)      Build the Docker image\n"
	@printf "  $(BOLD)make rebuild$(RESET)    Build with no cache (clean)\n"
	@printf "  $(BOLD)make up$(RESET)         Start the container (builds if needed)\n"
	@printf "  $(BOLD)make down$(RESET)       Stop and remove the container\n"
	@printf "  $(BOLD)make restart$(RESET)    down + up\n"
	@printf "  $(BOLD)make logs$(RESET)       Follow container logs\n"
	@printf "  $(BOLD)make shell$(RESET)      Open a shell inside the container\n"
	@printf "  $(BOLD)make status$(RESET)     Show container status\n"
	@printf "  $(BOLD)make clean$(RESET)      Remove container, image and data volume\n"
	@printf "\n$(CYAN)Local dev targets$(RESET)\n"
	@printf "  $(BOLD)make dev$(RESET)        Start dev server with hot-reload (ts-node)\n"
	@printf "  $(BOLD)make test$(RESET)       Run the Jest test suite\n"
	@printf "  $(BOLD)make typecheck$(RESET)  Run TypeScript compiler check only\n"
	@printf "\n$(CYAN)Demo targets$(RESET)\n"
	@printf "  $(BOLD)make demo$(RESET)       Full end-to-end demo (Brazil polygon)\n"
	@printf "  $(BOLD)make demo-de$(RESET)    Demo with a Berlin polygon\n"
	@printf "  $(BOLD)make demo-fail$(RESET)  Demo with an invalid geometry (shows error flow)\n"
	@printf "\n$(CYAN)API shortcuts$(RESET)\n"
	@printf "  $(BOLD)make open$(RESET)       Open Swagger UI in the browser\n"
	@printf "  $(BOLD)make wf WID=<id>$(RESET) Poll status + results for a workflow ID\n"
	@printf "\n"

# ─── Docker ───────────────────────────────────────────────────────────────────
.PHONY: build
build:
	@printf "$(CYAN)Building image $(BOLD)$(IMAGE)$(RESET)$(CYAN)...$(RESET)\n"
	docker build -t $(IMAGE) .

.PHONY: rebuild
rebuild:
	@printf "$(CYAN)Rebuilding image (no cache)...$(RESET)\n"
	docker build --no-cache -t $(IMAGE) .

.PHONY: up
up: build
	@if docker ps -q --filter name=$(CONTAINER) | grep -q .; then \
		printf "$(YELLOW)Container already running — run 'make restart' to reload.$(RESET)\n"; \
	else \
		docker volume create $(VOLUME) > /dev/null; \
		docker run -d \
			--name $(CONTAINER) \
			-p $(PORT):$(PORT) \
			-v $(VOLUME):/app/data \
			$(IMAGE); \
		printf "$(GREEN)Container started.$(RESET)\n"; \
		printf "  Server:  $(BOLD)http://localhost:$(PORT)$(RESET)\n"; \
		printf "  Swagger: $(BOLD)http://localhost:$(PORT)/api-docs$(RESET)\n"; \
	fi

.PHONY: down
down:
	@docker stop $(CONTAINER) 2>/dev/null && printf "$(GREEN)Container stopped.$(RESET)\n" || true
	@docker rm   $(CONTAINER) 2>/dev/null || true

.PHONY: restart
restart: down up

.PHONY: logs
logs:
	docker logs -f $(CONTAINER)

.PHONY: shell
shell:
	docker exec -it $(CONTAINER) sh

.PHONY: status
status:
	@docker ps --filter name=$(CONTAINER) --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

.PHONY: clean
clean: down
	@docker rmi $(IMAGE) 2>/dev/null && printf "$(GREEN)Image removed.$(RESET)\n" || true
	@docker volume rm $(VOLUME) 2>/dev/null && printf "$(GREEN)Volume removed.$(RESET)\n" || true

# ─── Local dev ────────────────────────────────────────────────────────────────
.PHONY: dev
dev:
	npm run dev

.PHONY: test
test:
	npm test

.PHONY: typecheck
typecheck:
	npx tsc --noEmit

# ─── Demo helpers ─────────────────────────────────────────────────────────────
_BRAZIL_GEOJSON := {"clientId":"demo-brazil","geoJson":{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-63.6249,-10.3111],[-63.6249,-10.3679],[-63.6128,-10.3679],[-63.6128,-10.3111],[-63.6249,-10.3111]]]},"properties":{}}}
_BERLIN_GEOJSON := {"clientId":"demo-berlin","geoJson":{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[13.2884,52.4539],[13.2884,52.5759],[13.5155,52.5759],[13.5155,52.4539],[13.2884,52.4539]]]},"properties":{}}}
_FAIL_GEOJSON   := {"clientId":"demo-error","geoJson":{"type":"Feature","geometry":{"type":"Point","coordinates":[13.4,52.5]},"properties":{}}}

define run_demo
	@printf "\n$(CYAN)POST /analysis$(RESET)\n"
	$(eval RESP := $(shell curl -s -X POST http://localhost:$(PORT)/analysis \
		-H 'Content-Type: application/json' \
		-d '$(1)'))
	@echo '$(RESP)' | python3 -m json.tool 2>/dev/null || echo '$(RESP)'
	$(eval WID := $(shell echo '$(RESP)' | python3 -c "import sys,json; print(json.load(sys.stdin).get('workflowId',''))" 2>/dev/null))
	@if [ -z "$(WID)" ]; then printf "$(YELLOW)Could not extract workflowId — is the server running?$(RESET)\n"; exit 1; fi
	@printf "\n$(CYAN)Workflow ID: $(BOLD)$(WID)$(RESET)\n"
	@printf "$(CYAN)Waiting 20 s for tasks to complete...$(RESET)\n"
	@sleep 20
	@printf "\n$(CYAN)GET /workflow/$(WID)/status$(RESET)\n"
	@curl -s http://localhost:$(PORT)/workflow/$(WID)/status | python3 -m json.tool
	@printf "\n$(CYAN)GET /workflow/$(WID)/results$(RESET)\n"
	@curl -s http://localhost:$(PORT)/workflow/$(WID)/results | python3 -m json.tool
endef

.PHONY: demo
demo:
	$(call run_demo,$(_BRAZIL_GEOJSON))

.PHONY: demo-de
demo-de:
	$(call run_demo,$(_BERLIN_GEOJSON))

.PHONY: demo-fail
demo-fail:
	$(call run_demo,$(_FAIL_GEOJSON))

# ─── API shortcuts ────────────────────────────────────────────────────────────
.PHONY: open
open:
	@xdg-open http://localhost:$(PORT)/api-docs 2>/dev/null || \
	 open      http://localhost:$(PORT)/api-docs 2>/dev/null || \
	 printf "$(YELLOW)Open http://localhost:$(PORT)/api-docs in your browser.$(RESET)\n"

# Usage: make wf WID=<workflow-id>
.PHONY: wf
wf:
	@if [ -z "$(WID)" ]; then printf "$(YELLOW)Usage: make wf WID=<workflow-id>$(RESET)\n"; exit 1; fi
	@printf "\n$(CYAN)Status$(RESET)\n"
	@curl -s http://localhost:$(PORT)/workflow/$(WID)/status | python3 -m json.tool
	@printf "\n$(CYAN)Results$(RESET)\n"
	@curl -s http://localhost:$(PORT)/workflow/$(WID)/results | python3 -m json.tool
