# ============================================================
#  Angular Docker Makefile
#  Supports: build, run, deploy, versioning, API config
# ============================================================

# ---------- Project Config ----------------------------------
APP_NAME        ?= fin-man-ui
REGISTRY        ?= ghcr.io/orton-hl
CONTAINER_PORT  ?= 4200
HOST_PORT       ?= 4200
CONTAINER_NAME  ?= $(APP_NAME)-container
PLATFORM        ?= linux/amd64
BUILD_ENV       ?= prd

# ---------- Version Tracking --------------------------------
VERSION_FILE    := .version
MAJOR           := $(shell cut -d. -f1 $(VERSION_FILE) 2>/dev/null || echo 1)
MINOR           := $(shell cut -d. -f2 $(VERSION_FILE) 2>/dev/null || echo 0)
PATCH           := $(shell cut -d. -f3 $(VERSION_FILE) 2>/dev/null || echo 0)
VERSION         := $(MAJOR).$(MINOR).$(PATCH)
IMAGE_TAG       := $(REGISTRY)/$(APP_NAME):$(VERSION)
IMAGE_LATEST    := $(REGISTRY)/$(APP_NAME):latest


# ---------- Colors ------------------------------------------
RED    := \033[0;31m
GREEN  := \033[0;32m
YELLOW := \033[0;33m
CYAN   := \033[0;36m
RESET  := \033[0m

# ============================================================
.PHONY: help init build run run-dev stop restart logs shell \
        bump-patch bump-minor bump-major tag push pull deploy \
        update-env clean prune version history act_deploy gh_deploy

# ============================================================
#  HELP
# ============================================================
help:
	@echo ""
	@echo "$(CYAN)╔══════════════════════════════════════════════════╗$(RESET)"
	@echo "$(CYAN)║        Angular Docker Makefile Commands          ║$(RESET)"
	@echo "$(CYAN)╚══════════════════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "$(YELLOW)Setup$(RESET)"
	@echo "  make init              Create .version and .env files"
	@echo ""
	@echo "$(YELLOW)Development$(RESET)"
	@echo "  make build             Build Docker image with current version"
	@echo "  make run               Run container with env file"
	@echo "  make run-dev           Run container with inline env vars"
	@echo "  make stop              Stop running container"
	@echo "  make restart           Stop then run container"
	@echo "  make logs              Tail container logs"
	@echo "  make shell             Open shell inside container"
	@echo ""
	@echo "$(YELLOW)Versioning$(RESET)"
	@echo "  make version           Show current version"
	@echo "  make bump-patch        Bump patch  (1.0.0 → 1.0.1)"
	@echo "  make bump-minor        Bump minor  (1.0.0 → 1.1.0)"
	@echo "  make bump-major        Bump major  (1.0.0 → 2.0.0)"
	@echo "  make history           Show image version history"
	@echo ""
	@echo "$(YELLOW)Registry & Deploy$(RESET)"
	@echo "  make tag               Tag image for registry"
	@echo "  make push              Push image to registry"
	@echo "  make pull              Pull image from registry"
	@echo "  make deploy            Bump patch + build + push in one step"
	@echo "  make act_deploy        Run deploy workflow locally with act"
	@echo "  make gh_deploy         Trigger deploy workflow on GitHub Actions"
	@echo ""
	@echo "$(YELLOW)External Services$(RESET)"
	@echo "  make update-env        Rewrite .env with current URL vars"
	@echo "  make show-env          Print current environment variables"
	@echo ""
	@echo "$(YELLOW)Cleanup$(RESET)"
	@echo "  make clean             Remove local container and image"
	@echo "  make prune             Remove ALL unused Docker resources"
	@echo ""
	@echo "$(YELLOW)Override examples$(RESET)"
	@echo "  make build BUILD_ENV=dev                  Build with dev environment"
	@echo "  make build BUILD_ENV=prd                  Build with prd environment (default)"
	@echo "  make run API_BASE_URL=https://api.prod.com HOST_PORT=9090"
	@echo "  make deploy REGISTRY=ghcr.io/myorg bump-minor"
	@echo ""

# ============================================================
#  INIT
# ============================================================
init:
	@if [ ! -f $(VERSION_FILE) ]; then \
		echo "1.0.0" > $(VERSION_FILE); \
		echo "$(GREEN)✔ Created $(VERSION_FILE) with version 1.0.0$(RESET)"; \
	else \
		echo "$(YELLOW)⚠ $(VERSION_FILE) already exists ($(VERSION))$(RESET)"; \
	fi
	@$(MAKE) update-env
	@echo "$(GREEN)✔ Init complete$(RESET)"

# ============================================================
#  VERSION TRACKING
# ============================================================
version:
	@echo "$(CYAN)Current version: $(VERSION)$(RESET)"
	@echo "Image tag:       $(IMAGE_TAG)"

bump-patch:
	@NEW_PATCH=$$(($(PATCH) + 1)); \
	NEW_VER="$(MAJOR).$(MINOR).$$NEW_PATCH"; \
	echo $$NEW_VER > $(VERSION_FILE); \
	echo "$(GREEN)✔ Bumped to $$NEW_VER$(RESET)"

bump-minor:
	@NEW_MINOR=$$(($(MINOR) + 1)); \
	NEW_VER="$(MAJOR).$$NEW_MINOR.0"; \
	echo $$NEW_VER > $(VERSION_FILE); \
	echo "$(GREEN)✔ Bumped to $$NEW_VER$(RESET)"

bump-major:
	@NEW_MAJOR=$$(($(MAJOR) + 1)); \
	NEW_VER="$$NEW_MAJOR.0.0"; \
	echo $$NEW_VER > $(VERSION_FILE); \
	echo "$(GREEN)✔ Bumped to $$NEW_VER$(RESET)"

history:
	@echo "$(CYAN)── Local image versions ──$(RESET)"
	@docker images $(REGISTRY)/$(APP_NAME) --format "table {{.Tag}}\t{{.CreatedAt}}\t{{.Size}}" 2>/dev/null || \
		echo "No images found for $(REGISTRY)/$(APP_NAME)"

# ============================================================
#  EXTERNAL SERVICE ENVIRONMENT
# ============================================================
update-env:
	@echo "# Auto-generated by Makefile — do not edit manually" > .env
	@echo "API_BASE_URL=$(API_BASE_URL)"   >> .env
	@echo "AUTH_URL=$(AUTH_URL)"           >> .env
	@echo "STORAGE_URL=$(STORAGE_URL)"     >> .env
	@echo "CDN_URL=$(CDN_URL)"             >> .env
	@echo "APP_VERSION=$(VERSION)"         >> .env
	@echo "$(GREEN)✔ .env updated$(RESET)"

show-env:
	@echo "$(CYAN)── Environment Variables ──$(RESET)"
	@echo "  APP_NAME     = $(APP_NAME)"
	@echo "  VERSION      = $(VERSION)"
	@echo "  API_BASE_URL = $(API_BASE_URL)"
	@echo "  AUTH_URL     = $(AUTH_URL)"
	@echo "  STORAGE_URL  = $(STORAGE_URL)"
	@echo "  CDN_URL      = $(CDN_URL)"
	@echo "  IMAGE_TAG    = $(IMAGE_TAG)"

# ============================================================
#  BUILD
# ============================================================
build: update-env
	@echo "$(CYAN)── Building $(IMAGE_TAG) [env: $(BUILD_ENV)] ──$(RESET)"
	docker build \
		--platform $(PLATFORM) \
		--build-arg BUILD_ENV=$(BUILD_ENV) \
		--build-arg API_BASE_URL=$(API_BASE_URL) \
		--build-arg APP_VERSION=$(VERSION) \
		--label "version=$(VERSION)" \
		--label "build-env=$(BUILD_ENV)" \
		--label "build-date=$$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
		-t $(IMAGE_TAG) \
		-t $(IMAGE_LATEST) \
		.
	@echo "$(GREEN)✔ Build complete: $(IMAGE_TAG) [env: $(BUILD_ENV)]$(RESET)"

# ============================================================
#  RUN
# ============================================================
ENV_FILE        ?= .env

run: stop
	@echo "$(CYAN)── Starting container on port $(HOST_PORT) ──$(RESET)"
	docker run -d \
		--platform $(PLATFORM) \
		--name $(CONTAINER_NAME) \
		-p $(HOST_PORT):$(CONTAINER_PORT) \
		--env-file $(ENV_FILE) \
		--restart unless-stopped \
		$(IMAGE_TAG)
	@echo "$(GREEN)✔ Running at http://localhost:$(HOST_PORT)$(RESET)"

run-dev:
	@echo "$(CYAN)── Starting container on port $(HOST_PORT) ──$(RESET)"
	@docker rm -f $(CONTAINER_NAME) 2>/dev/null || true
	docker run -d \
		--platform $(PLATFORM) \
		--name $(CONTAINER_NAME) \
		-p $(HOST_PORT):$(CONTAINER_PORT) \
		-e API_BASE_URL=$(API_BASE_URL) \
		-e APP_VERSION=$(VERSION) \
		--add-host=host.docker.internal:host-gateway \
		--restart unless-stopped \
		$(IMAGE_TAG)
	@echo "$(GREEN)✔ Running at http://localhost:$(HOST_PORT)$(RESET)"

stop:
	@echo "$(YELLOW)── Stopping $(CONTAINER_NAME) ──$(RESET)"
	@docker stop $(CONTAINER_NAME) 2>/dev/null || true
	@docker rm   $(CONTAINER_NAME) 2>/dev/null || true
	@echo "$(GREEN)✔ Stopped$(RESET)"

restart: stop run

logs:
	docker logs -f $(CONTAINER_NAME)

shell:
	docker exec -it $(CONTAINER_NAME) /bin/sh

# ============================================================
#  REGISTRY & DEPLOY
# ============================================================
tag:
	@echo "$(CYAN)── Tagging image ──$(RESET)"
	docker tag $(IMAGE_TAG)    $(REGISTRY)/$(APP_NAME):$(VERSION)
	docker tag $(IMAGE_LATEST) $(REGISTRY)/$(APP_NAME):latest
	@echo "$(GREEN)✔ Tagged $(VERSION) and latest$(RESET)"

push: tag
	@echo "$(CYAN)── Pushing to $(REGISTRY) ──$(RESET)"
	docker push $(REGISTRY)/$(APP_NAME):$(VERSION)
	docker push $(REGISTRY)/$(APP_NAME):latest
	@echo "$(GREEN)✔ Pushed $(VERSION) and latest$(RESET)"

pull:
	@echo "$(CYAN)── Pulling from $(REGISTRY) ──$(RESET)"
	docker pull $(REGISTRY)/$(APP_NAME):$(VERSION)
	@echo "$(GREEN)✔ Pulled $(VERSION)$(RESET)"

# Full release pipeline: bump → build → push
deploy: bump-patch build push
	@echo "$(GREEN)✔ Deployed version $$(cat $(VERSION_FILE))$(RESET)"

# ============================================================
#  CLEANUP
# ============================================================
clean: stop
	@echo "$(YELLOW)── Removing image $(IMAGE_TAG) ──$(RESET)"
	@docker rmi $(IMAGE_TAG)    2>/dev/null || true
	@docker rmi $(IMAGE_LATEST) 2>/dev/null || true
	@echo "$(GREEN)✔ Clean complete$(RESET)"

prune:
	@echo "$(RED)── Pruning ALL unused Docker resources ──$(RESET)"
	docker system prune -af --volumes
	@echo "$(GREEN)✔ Prune complete$(RESET)"

act_deploy:
	@echo "$(CYAN)── Deploying to production ──$(RESET)"
	@echo "This would run the deployment script, e.g. pulling the latest image and restarting the container."
	act -W .github/workflows/deploy.yml  workflow_dispatch --secret-file .github/workflows/secrets.example
	@echo "$(GREEN)✔ act_deploy complete$(RESET)"

gh_deploy:
	@echo "$(CYAN)── Triggering deploy workflow on GitHub Actions ──$(RESET)"
	gh workflow run deploy.yml
	@echo "$(GREEN)✔ Workflow triggered$(RESET)"