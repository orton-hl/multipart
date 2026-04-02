"""
conftest.py — pytest fixtures for LocalStack integration tests.

Run integration tests with LocalStack running:
  docker compose up -d localstack
  pytest tests/ -m integration -v

Unit tests (no LocalStack needed):
  pytest tests/ -m "not integration" -v
"""
from __future__ import annotations

import os
import pytest
import pytest_asyncio
import aioboto3

# Point all AWS calls at LocalStack
LOCALSTACK_URL = os.getenv("AWS_ENDPOINT_URL", "http://localhost:4566")
AWS_CREDS = {
    "aws_access_key_id": "test",
    "aws_secret_access_key": "test",
    "region_name": "eu-west-1",
    "endpoint_url": LOCALSTACK_URL,
}
BUCKET = os.getenv("S3_BUCKET", "co-uploads-local")


# ── Boto3 session scoped to test run ─────────────────────────────────────────

@pytest.fixture(scope="session")
def aws_session():
    return aioboto3.Session()


@pytest_asyncio.fixture(scope="session")
async def s3_client(aws_session):
    async with aws_session.client("s3", **AWS_CREDS) as client:
        yield client


@pytest_asyncio.fixture(scope="session")
async def kms_client(aws_session):
    async with aws_session.client("kms", **AWS_CREDS) as client:
        yield client


# ── Ensure bucket exists before tests ────────────────────────────────────────

@pytest_asyncio.fixture(scope="session", autouse=True)
async def ensure_bucket(s3_client):
    try:
        await s3_client.create_bucket(
            Bucket=BUCKET,
            CreateBucketConfiguration={"LocationConstraint": "eu-west-1"},
        )
    except s3_client.exceptions.BucketAlreadyOwnedByYou:
        pass
    except Exception:
        pass  # already exists


# ── JWT helper ────────────────────────────────────────────────────────────────

@pytest.fixture()
def auth_headers():
    import jwt
    token = jwt.encode(
        {"sub": "partner-test", "email": "test@example.com"},
        "localstack-dev-secret",
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def api_key_headers():
    return {"X-API-Key": "devkey-1"}
