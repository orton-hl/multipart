# S3 Multipart Upload Service

A full-stack application for secure, scalable large-file uploads using AWS S3 multipart upload with presigned URLs.

## Architecture Overview

- **Frontend**: React + Vite SPA with Zustand state management
- **Backend**: FastAPI with async S3 operations (aioboto3)
- **Storage**: AWS S3 (or LocalStack for local development)

## Interaction Sequence Diagram

```mermaid
sequenceDiagram
    participant Browser as Browser (React)
    participant API as FastAPI Backend
    participant S3 as AWS S3

    %% Phase 1: Initiation
    rect rgb(240, 248, 255)
        Note over Browser,S3: Phase 1: Upload Initiation
        Browser->>+API: POST /uploads<br/>(filename, size, part_count, encryption)
        API->>API: Validate request<br/>(size limits, content-type)
        API->>+S3: CreateMultipartUpload
        S3-->>-API: s3_upload_id
        API->>API: Store UploadRecord<br/>(status: IN_PROGRESS)
        API->>+S3: Generate presigned URLs<br/>(one per part)
        S3-->>-API: Signed PUT URLs
        API-->>-Browser: InitiateUploadResponse<br/>(upload_id, presigned_urls[], ttl)
    end

    %% Phase 2: Upload Parts
    rect rgb(255, 250, 240)
        Note over Browser,S3: Phase 2: Concurrent Part Uploads
        Browser->>Browser: Split file into chunks

        par Upload Part 1
            Browser->>+S3: PUT presigned_url_1<br/>(chunk data)
            S3-->>-Browser: 200 OK + ETag_1
        and Upload Part 2
            Browser->>+S3: PUT presigned_url_2<br/>(chunk data)
            S3-->>-Browser: 200 OK + ETag_2
        and Upload Part 3
            Browser->>+S3: PUT presigned_url_3<br/>(chunk data)
            S3-->>-Browser: 200 OK + ETag_3
        and Upload Part N
            Browser->>+S3: PUT presigned_url_N<br/>(chunk data)
            S3-->>-Browser: 200 OK + ETag_N
        end

        Browser->>Browser: Collect all ETags<br/>(retry failed parts up to 4x)
    end

    %% Phase 3: Completion
    rect rgb(240, 255, 240)
        Note over Browser,S3: Phase 3: Complete Upload
        Browser->>+API: POST /uploads/complete<br/>(upload_id, parts[{number, etag}])
        API->>API: Fetch UploadRecord<br/>Update status: COMPLETING
        API->>+S3: CompleteMultipartUpload<br/>(parts list)
        S3->>S3: Stitch parts together
        S3-->>-API: Final ETag + metadata
        API->>API: Update status: COMPLETED
        API-->>-Browser: CompleteUploadResponse<br/>(file_key, etag, size, completed_at)
        Browser->>Browser: Update UI<br/>Show success notification
    end
```

## Key Features

- **Direct S3 uploads** - File data goes directly to S3, not through the backend
- **Concurrent uploads** - Multiple parts upload in parallel (default: 4)
- **Automatic retries** - Failed parts retry up to 4 times with exponential backoff
- **URL refresh** - Expired presigned URLs can be refreshed without restarting
- **Dual authentication** - Supports both JWT and API Key authentication
- **Encryption support** - SSE-S3 and SSE-KMS encryption options

## Project Structure

```
multipart/
├── s3_upload_api/           # FastAPI backend
│   ├── app/
│   │   ├── main.py          # App setup, middleware
│   │   ├── config.py        # Environment settings
│   │   ├── routers/         # API endpoints
│   │   └── services/        # S3 and storage services
│   └── docker-compose.yml   # LocalStack setup
│
└── upload-ui/               # React frontend
    ├── src/
    │   ├── pages/           # NewUpload, ActiveUploads, History
    │   ├── services/api.js  # Upload orchestration
    │   └── store/           # Zustand state management
    └── package.json
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/uploads` | Initiate multipart upload |
| POST | `/uploads/complete` | Complete multipart upload |
| GET | `/uploads/{id}/status` | Get upload status |
| GET | `/uploads/list-active` | List active uploads |
| GET | `/uploads/{id}/part/{n}/refresh` | Refresh presigned URL |
| DELETE | `/uploads/{id}` | Abort upload |

## Getting Started

### Local Development with LocalStack

```bash
# Start LocalStack and API
cd s3_upload_api
docker-compose up -d

# Start frontend
cd upload-ui
npm install
npm run dev
```

### Environment Variables

**Backend** (`s3_upload_api/.env`):
```
AWS_REGION=eu-west-1
AWS_ENDPOINT_URL=http://localhost:4566
S3_BUCKET=co-uploads-dev
JWT_SECRET=your-secret-key
API_KEYS=devkey-1,devkey-2
```

**Frontend** (`upload-ui/.env`):
```
VITE_API_BASE=http://localhost:8000
```
