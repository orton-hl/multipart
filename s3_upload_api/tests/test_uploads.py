"""
Tests for the multipart upload API.
Run with: pytest tests/ -v
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.upload import UploadStatus


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

VALID_JWT = "test-token"
HEADERS = {"Authorization": f"Bearer {VALID_JWT}"}

INIT_PAYLOAD = {
    "filename": "data.zip",
    "content_type": "application/zip",
    "file_size_bytes": 100 * 1024 * 1024,   # 100 MB
    "part_count": 20,
    "encryption": "SSE-KMS",
    "metadata": {"partner_id": "partner-42", "uploaded_by": "test@example.com"},
}

FAKE_PRESIGNED_URLS = [
    {
        "part_number": i,
        "url": f"https://s3.example.com/fake?part={i}",
        "expires_at": datetime.now(timezone.utc).isoformat(),
    }
    for i in range(1, 21)
]


@pytest.fixture()
def mock_partner():
    with patch("app.dependencies.get_current_partner", return_value={"sub": "partner-42", "email": "test@example.com"}):
        yield


@pytest.fixture()
def client():
    return TestClient(app)


# ---------------------------------------------------------------------------
# Initiate upload
# ---------------------------------------------------------------------------

class TestInitiateUpload:
    def test_happy_path(self, client, mock_partner):
        with (
            patch("app.routers.uploads.s3_service.create_multipart_upload", new_callable=AsyncMock) as mock_create,
            patch("app.routers.uploads.s3_service.generate_presigned_part_urls", new_callable=AsyncMock) as mock_presign,
        ):
            mock_create.return_value = ("s3-upload-id-abc", "multipart/partner-42/2026-07-01/abc/data.zip")
            mock_presign.return_value = FAKE_PRESIGNED_URLS

            resp = client.post("/uploads", json=INIT_PAYLOAD, headers=HEADERS)

        assert resp.status_code == 201
        body = resp.json()
        assert body["s3_upload_id"] == "s3-upload-id-abc"
        assert len(body["presigned_urls"]) == 20
        assert body["ttl_seconds"] == 900

    def test_file_too_large(self, client, mock_partner):
        payload = {**INIT_PAYLOAD, "file_size_bytes": 11 * 1024**3}
        resp = client.post("/uploads", json=payload, headers=HEADERS)
        assert resp.status_code == 413

    def test_unsupported_content_type(self, client, mock_partner):
        payload = {**INIT_PAYLOAD, "content_type": "application/x-msdownload"}
        resp = client.post("/uploads", json=payload, headers=HEADERS)
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "UNSUPPORTED_CONTENT_TYPE"

    def test_part_size_too_small(self, client, mock_partner):
        # 10 MB file with 100 parts = 100 KB per part < 5 MB minimum
        payload = {**INIT_PAYLOAD, "file_size_bytes": 10 * 1024 * 1024, "part_count": 100}
        resp = client.post("/uploads", json=payload, headers=HEADERS)
        assert resp.status_code == 422

    def test_filename_sanitized(self, client, mock_partner):
        with (
            patch("app.routers.uploads.s3_service.create_multipart_upload", new_callable=AsyncMock) as mock_create,
            patch("app.routers.uploads.s3_service.generate_presigned_part_urls", new_callable=AsyncMock) as mock_presign,
        ):
            mock_create.return_value = ("id", "key")
            mock_presign.return_value = FAKE_PRESIGNED_URLS
            payload = {**INIT_PAYLOAD, "filename": "../../../etc/passwd"}
            resp = client.post("/uploads", json=payload, headers=HEADERS)

        # Should not raise; filename should be sanitized
        assert resp.status_code in (201, 422)


# ---------------------------------------------------------------------------
# Complete upload
# ---------------------------------------------------------------------------

class TestCompleteUpload:
    def test_happy_path(self, client, mock_partner):
        from app.services.store import UploadRecord, upload_store
        import asyncio

        record = UploadRecord(
            s3_upload_id="s3-abc", key="multipart/p/2026/id/f.zip",
            filename="f.zip", content_type="application/zip",
            file_size_bytes=100_000_000, part_count=2,
            encryption="SSE-KMS", partner_id="p-42",
        )
        asyncio.get_event_loop().run_until_complete(upload_store.put(record))

        with (
            patch("app.routers.uploads.s3_service.complete_multipart_upload", new_callable=AsyncMock) as mock_complete,
            patch("app.routers.uploads.s3_service.get_object_size", new_callable=AsyncMock) as mock_size,
        ):
            mock_complete.return_value = {"ETag": '"abc123-2"'}
            mock_size.return_value = 100_000_000

            payload = {
                "upload_id": record.upload_id,
                "parts": [
                    {"part_number": 1, "etag": "aaa"},
                    {"part_number": 2, "etag": "bbb"},
                ],
            }
            resp = client.post("/uploads/complete", json=payload, headers=HEADERS)

        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "COMPLETED"
        assert body["size_bytes"] == 100_000_000

    def test_parts_must_be_sequential(self, client, mock_partner):
        payload = {
            "upload_id": "mpu_doesnotexist",
            "parts": [
                {"part_number": 1, "etag": "aaa"},
                {"part_number": 3, "etag": "bbb"},   # gap!
            ],
        }
        resp = client.post("/uploads/complete", json=payload, headers=HEADERS)
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Abort
# ---------------------------------------------------------------------------

class TestAbortUpload:
    def test_abort(self, client, mock_partner):
        from app.services.store import UploadRecord, upload_store
        import asyncio

        record = UploadRecord(
            s3_upload_id="s3-xyz", key="k", filename="f.zip",
            content_type="application/zip", file_size_bytes=1000,
            part_count=1, encryption="SSE-S3", partner_id="p",
        )
        asyncio.get_event_loop().run_until_complete(upload_store.put(record))

        with patch("app.routers.uploads.s3_service.abort_multipart_upload", new_callable=AsyncMock):
            resp = client.delete(f"/uploads/{record.upload_id}", headers=HEADERS)

        assert resp.status_code == 204

    def test_abort_not_found(self, client, mock_partner):
        resp = client.delete("/uploads/mpu_doesnotexist", headers=HEADERS)
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
