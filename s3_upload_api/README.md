# S3 Multipart Upload API — Local Development

## Quick start

```bash
# 1. Start LocalStack + API + S3 browser
make up

# 2. Open Swagger UI
open http://localhost:8000/docs

# 3. Open S3 browser (inspect uploaded objects)
open http://localhost:8888

# 4. Generate a dev JWT
make gen-token

# 5. Fire a test upload via curl
make test-upload
```

## Services

| Service       | URL                              | Purpose                        |
|---------------|----------------------------------|--------------------------------|
| FastAPI        | http://localhost:8000/docs       | Swagger UI + API               |
| LocalStack     | http://localhost:4566            | AWS (S3, KMS, STS, CW, Lambda) |
| S3 Browser     | http://localhost:8888            | Browse uploaded objects        |

## Running tests

```bash
# Unit tests only (no LocalStack needed)
make test-unit

# Integration tests (requires make up)
make test-integration

# Both
make test
```

## Useful commands

```bash
# List all multipart uploads in progress
make ls-uploads

# List all objects in bucket
make ls-objects

# Tail all logs
make logs

# Check LocalStack service health
make status

# Shell into LocalStack container
make shell-localstack
```

## Auth

Two auth methods supported:

**JWT (VDI / user clients)**
```bash
TOKEN=$(make gen-token | awk '{print $2}')
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/uploads/...
```

**API Key (partner machine-to-machine)**
```bash
curl -H "X-API-Key: devkey-1" http://localhost:8000/uploads/...
```

Dev API keys: `devkey-1`, `devkey-2` (set in `docker-compose.yml`)

## Environment

All settings are in `docker-compose.yml` under the `api` service.  
Copy `.env.example` → `.env` for production deployment.

## LocalStack init

On startup, `infra/init-aws.sh` automatically creates:
- KMS CMK (`alias/co-uploads-local`)
- S3 bucket `co-uploads-local` with lifecycle rules + bucket policy
- IAM role `upload-service-local` with least-privilege policy
- CloudWatch log groups `/upload-service/api` and `/upload-service/cleanup`
- EventBridge rule for daily cleanup cron
- Cleanup Lambda function
