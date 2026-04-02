.PHONY: help up up-aws up-api down logs test test-unit test-integration shell-localstack status clean dev

# Colors
GREEN  := \033[0;32m
YELLOW := \033[0;33m
CYAN   := \033[0;36m
RESET  := \033[0m

# Relative folder paths
API_DIR  := s3_upload_api
AWS_DIR  := aws-local-stack

.DEFAULT_GOAL := help

help: ## Show this help
	@echo ""
	@echo "$(CYAN)S3 Multipart Upload API$(RESET)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  $(GREEN)%-18s$(RESET) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""

# ── Stack lifecycle ────────────────────────────────────────────────────────────

up: up-aws up-api ## Start all services (LocalStack + API)

up-aws: ## Start LocalStack only
	docker compose -f $(AWS_DIR)/docker-compose.yml up -d
	@echo "Waiting for LocalStack to be healthy..."
	@until curl -sf http://localhost:4566/_localstack/health | grep -q '"s3": "available"'; do sleep 2; done
	@echo "✓ LocalStack ready"

up-api: ## Start API only
	docker compose -f $(API_DIR)/docker-compose.yml up -d --build
	@echo "✓ API        → http://localhost:8000/docs"
	@echo "✓ S3 browser → http://localhost:8888"

down: ## Stop all services and remove volumes
	docker compose -f $(API_DIR)/docker-compose.yml down -v
	docker compose -f $(AWS_DIR)/docker-compose.yml down -v

restart: ## Restart the API container
	docker compose -f $(API_DIR)/docker-compose.yml restart api

logs: ## Tail logs from all services
	docker compose -f $(API_DIR)/docker-compose.yml logs -f

logs-api: ## Tail logs from API only
	docker compose -f $(API_DIR)/docker-compose.yml logs -f api

logs-ls: ## Tail logs from LocalStack only
	docker compose -f $(AWS_DIR)/docker-compose.yml logs -f localstack

status: ## Show health status of services
	@curl -s http://localhost:4566/_localstack/health | python3 -m json.tool
	@echo ""
	@curl -s http://localhost:8000/health

dev: ## Run API locally with auto-reload (uvicorn)
	cd $(API_DIR) && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --env-file .env.dev

# ── Tests ─────────────────────────────────────────────────────────────────────

test-unit: ## Run unit tests
	cd $(API_DIR) && pytest tests/test_uploads.py -v -m "not integration"

test-integration: ## Run integration tests (requires: make up)
	@echo "Requires: make up"
	cd $(API_DIR) && API_BASE_URL=http://localhost:8000 pytest tests/test_integration.py -v

test: test-unit test-integration ## Run all tests

# ── LocalStack AWS CLI shortcuts ───────────────────────────────────────────────

LS=aws --endpoint-url=http://localhost:4566 --region eu-west-1 --no-cli-pager

ls-buckets: ## List S3 buckets in LocalStack
	$(LS) s3 ls

ls-uploads: ## List multipart uploads in progress
	$(LS) s3api list-multipart-uploads --bucket co-uploads-local

ls-objects: ## List all objects in bucket
	$(LS) s3 ls s3://co-uploads-local/ --recursive

ls-keys: ## List KMS keys
	$(LS) kms list-keys

shell-localstack: ## Open shell in LocalStack container
	docker exec -it localstack bash

# ── Dev helpers ────────────────────────────────────────────────────────────────

gen-token: ## Generate a dev JWT token
	@python3 -c "\
import jwt; \
token = jwt.encode({'sub':'dev-user','email':'dev@example.com'}, 'localstack-dev-secret', algorithm='HS256'); \
print('Bearer', token)"

test-upload: ## Initiate a test multipart upload
	@echo "Generating token and initiating test upload..."
	@cd $(API_DIR) && TOKEN=$$(python3 -c "import jwt; print(jwt.encode({'sub':'dev','email':'dev@test.com'}, 'localstack-dev-secret', algorithm='HS256'))"); \
	curl -s -X POST http://localhost:8000/uploads \
	  -H "Authorization: Bearer $$TOKEN" \
	  -H "Content-Type: application/json" \
	  -d '{"filename":"test.zip","content_type":"application/zip","file_size_bytes":10485760,"part_count":2,"encryption":"SSE-S3","metadata":{"partner_id":"cli-test"}}' \
	  | python3 -m json.tool

clean: ## Remove containers, volumes, and cache files
	docker compose -f $(API_DIR)/docker-compose.yml down -v --remove-orphans
	docker compose -f $(AWS_DIR)/docker-compose.yml down -v --remove-orphans
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
