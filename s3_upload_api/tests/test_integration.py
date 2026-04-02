"""
Integration tests — require LocalStack running.
Mark: @pytest.mark.integration

Run:
  docker compose up -d localstack
  pytest tests/test_integration.py -v
"""
from __future__ import annotations

import os
import pytest
import httpx

API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000")

pytestmark = pytest.mark.integration


# ── Helpers ───────────────────────────────────────────────────────────────────

def _init_payload(**overrides) -> dict:
    base = {
        "filename": "test-file.zip",
        "content_type": "application/zip",
        "file_size_bytes": 20 * 1024 * 1024,   # 20 MB
        "part_count": 4,                         # 5 MB each
        "encryption": "SSE-S3",                  # SSE-S3 works without KMS key
        "metadata": {"partner_id": "partner-test", "uploaded_by": "pytest"},
    }
    base.update(overrides)
    return base


# ── Health ─────────────────────────────────────────────────────────────────────

def test_health():
    resp = httpx.get(f"{API_BASE}/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# ── Initiate upload ────────────────────────────────────────────────────────────

def test_initiate_returns_presigned_urls(auth_headers):
    resp = httpx.post(f"{API_BASE}/uploads", json=_init_payload(), headers=auth_headers)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert "upload_id" in body
    assert body["upload_id"].startswith("mpu_")
    assert len(body["presigned_urls"]) == 4
    assert body["ttl_seconds"] == 900
    for item in body["presigned_urls"]:
        assert item["url"].startswith("http")
        assert item["part_number"] >= 1


def test_initiate_with_api_key(api_key_headers):
    resp = httpx.post(f"{API_BASE}/uploads", json=_init_payload(), headers=api_key_headers)
    assert resp.status_code == 201


def test_initiate_rejects_missing_auth():
    resp = httpx.post(f"{API_BASE}/uploads", json=_init_payload())
    assert resp.status_code == 401


def test_initiate_rejects_large_file(auth_headers):
    payload = _init_payload(file_size_bytes=11 * 1024**3, part_count=2200)
    resp = httpx.post(f"{API_BASE}/uploads", json=payload, headers=auth_headers)
    assert resp.status_code == 413


def test_initiate_rejects_bad_content_type(auth_headers):
    resp = httpx.post(
        f"{API_BASE}/uploads",
        json=_init_payload(content_type="application/x-msdownload"),
        headers=auth_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "UNSUPPORTED_CONTENT_TYPE"


# ── Full upload flow ───────────────────────────────────────────────────────────

def test_full_multipart_upload_flow(auth_headers):
    """
    Full end-to-end: initiate → PUT parts → complete → verify status.
    Uses 4 × 5 MB synthetic chunks uploaded directly to LocalStack S3.
    """
    PART_SIZE = 5 * 1024 * 1024

    # 1. Initiate
    resp = httpx.post(f"{API_BASE}/uploads", json=_init_payload(), headers=auth_headers, timeout=30)
    assert resp.status_code == 201
    session = resp.json()
    upload_id = session["upload_id"]
    presigned_urls = session["presigned_urls"]

    # 2. PUT each part directly to LocalStack S3
    etags = []
    for item in presigned_urls:
        chunk = b"X" * PART_SIZE
        put_resp = httpx.put(
            item["url"],
            content=chunk,
            headers={"Content-Type": "application/octet-stream"},
            timeout=60,
        )
        assert put_resp.status_code == 200, f"Part {item['part_number']} PUT failed: {put_resp.text}"
        etag = put_resp.headers.get("ETag", "").strip('"')
        etags.append({"part_number": item["part_number"], "etag": etag})

    # 3. Complete
    complete_resp = httpx.post(
        f"{API_BASE}/uploads/complete",
        json={"upload_id": upload_id, "parts": etags},
        headers=auth_headers,
        timeout=30,
    )
    assert complete_resp.status_code == 200, complete_resp.text
    result = complete_resp.json()
    assert result["status"] == "COMPLETED"
    assert result["size_bytes"] == PART_SIZE * 4

    # 4. Check status
    status_resp = httpx.get(
        f"{API_BASE}/uploads/{upload_id}/status",
        headers=auth_headers,
    )
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "COMPLETED"


# ── Abort flow ────────────────────────────────────────────────────────────────

def test_abort_upload(auth_headers):
    # Initiate
    resp = httpx.post(f"{API_BASE}/uploads", json=_init_payload(), headers=auth_headers)
    assert resp.status_code == 201
    upload_id = resp.json()["upload_id"]

    # Abort
    del_resp = httpx.delete(f"{API_BASE}/uploads/{upload_id}", headers=auth_headers)
    assert del_resp.status_code == 204

    # Status should be ABORTED
    status_resp = httpx.get(f"{API_BASE}/uploads/{upload_id}/status", headers=auth_headers)
    assert status_resp.json()["status"] == "ABORTED"


def test_abort_not_found(auth_headers):
    resp = httpx.delete(f"{API_BASE}/uploads/mpu_doesnotexist000", headers=auth_headers)
    assert resp.status_code == 404


# ── Presigned URL refresh ─────────────────────────────────────────────────────

def test_refresh_presigned_url(auth_headers):
    resp = httpx.post(f"{API_BASE}/uploads", json=_init_payload(), headers=auth_headers)
    upload_id = resp.json()["upload_id"]

    refresh = httpx.get(
        f"{API_BASE}/uploads/{upload_id}/part/1/refresh",
        headers=auth_headers,
    )
    assert refresh.status_code == 200
    body = refresh.json()
    assert body["part_number"] == 1
    assert body["url"].startswith("http")


# ── Cleanup endpoint ───────────────────────────────────────────────────────────

def test_cleanup_endpoint(auth_headers):
    resp = httpx.post(f"{API_BASE}/uploads/cleanup", headers=auth_headers, timeout=30)
    assert resp.status_code == 200
    body = resp.json()
    assert "stale_found" in body
    assert "aborted" in body
