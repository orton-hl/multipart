"""
UploadStore: tracks upload sessions (uploadId → state).

In production, replace the in-memory dict with DynamoDB or Redis
for multi-instance / persistent state. The interface stays identical.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.config import settings
from app.models.upload import UploadStatus


class UploadRecord:
    __slots__ = (
        "upload_id", "s3_upload_id", "key", "filename", "content_type",
        "file_size_bytes", "part_count", "encryption", "partner_id",
        "uploaded_by", "checksum_sha256", "status", "created_at",
        "expires_at", "completed_at", "error_message", "etag",
    )

    def __init__(
        self,
        s3_upload_id: str,
        key: str,
        filename: str,
        content_type: str,
        file_size_bytes: int,
        part_count: int,
        encryption: str,
        partner_id: str,
        uploaded_by: str = "",
        checksum_sha256: str | None = None,
    ):
        self.upload_id: str = f"mpu_{uuid.uuid4().hex[:16]}"
        self.s3_upload_id = s3_upload_id
        self.key = key
        self.filename = filename
        self.content_type = content_type
        self.file_size_bytes = file_size_bytes
        self.part_count = part_count
        self.encryption = encryption
        self.partner_id = partner_id
        self.uploaded_by = uploaded_by
        self.checksum_sha256 = checksum_sha256
        self.status = UploadStatus.IN_PROGRESS
        self.created_at = datetime.now(timezone.utc)
        self.expires_at = self.created_at + timedelta(seconds=settings.PRESIGN_TTL_SECONDS)
        self.completed_at: Optional[datetime] = None
        self.error_message: Optional[str] = None
        self.etag: Optional[str] = None


class UploadStore:
    """
    Thread-safe in-memory store. Replace _store with a DynamoDB client
    by implementing the same get/put/delete interface.
    """

    def __init__(self):
        self._store: dict[str, UploadRecord] = {}
        self._lock = asyncio.Lock()

    async def put(self, record: UploadRecord) -> None:
        async with self._lock:
            self._store[record.upload_id] = record

    async def get(self, upload_id: str) -> Optional[UploadRecord]:
        async with self._lock:
            return self._store.get(upload_id)

    async def require(self, upload_id: str) -> UploadRecord:
        record = await self.get(upload_id)
        if record is None:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail=f"Upload {upload_id} not found")
        return record

    async def update_status(
        self,
        upload_id: str,
        status: UploadStatus,
        *,
        etag: str | None = None,
        error_message: str | None = None,
    ) -> None:
        async with self._lock:
            record = self._store.get(upload_id)
            if record:
                record.status = status
                if etag:
                    record.etag = etag
                if error_message:
                    record.error_message = error_message
                if status == UploadStatus.COMPLETED:
                    record.completed_at = datetime.now(timezone.utc)

    async def delete(self, upload_id: str) -> None:
        async with self._lock:
            self._store.pop(upload_id, None)

    async def list_active(self) -> list[UploadRecord]:
        async with self._lock:
            return [
                r for r in self._store.values()
                if r.status == UploadStatus.IN_PROGRESS
            ]


# Singleton
upload_store = UploadStore()
