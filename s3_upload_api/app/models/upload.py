from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class EncryptionType(str, Enum):
    SSE_S3 = "SSE-S3"
    SSE_KMS = "SSE-KMS"


class UploadStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETING = "COMPLETING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ABORTED = "ABORTED"


# ---------------------------------------------------------------------------
# Initiate upload
# ---------------------------------------------------------------------------

class UploadMetadata(BaseModel):
    partner_id: Optional[str] = None
    uploaded_by: Optional[str] = None
    tags: Optional[dict[str, str]] = None


class InitiateUploadRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    content_type: str
    file_size_bytes: int = Field(..., gt=0)
    part_count: int = Field(..., ge=1, le=10_000)
    checksum_sha256: Optional[str] = Field(None, pattern=r"^[a-fA-F0-9]{64}$")
    encryption: EncryptionType = EncryptionType.SSE_KMS
    metadata: Optional[UploadMetadata] = None

    @field_validator("filename")
    @classmethod
    def sanitize_filename(cls, v: str) -> str:
        # Strip path traversal attempts
        import re
        safe = re.sub(r"[^\w\-. ]", "_", v.strip())
        if not safe:
            raise ValueError("Filename contains no valid characters")
        return safe

    @model_validator(mode="after")
    def validate_part_size(self) -> "InitiateUploadRequest":
        min_part = 5 * 1024 * 1024  # 5 MB
        if self.part_count > 1:
            part_size = self.file_size_bytes / self.part_count
            if part_size < min_part:
                raise ValueError(
                    f"Each part must be ≥5 MB. "
                    f"For {self.file_size_bytes} bytes use ≤{self.file_size_bytes // min_part} parts."
                )
        return self


class PresignedUrlItem(BaseModel):
    part_number: int
    url: str
    expires_at: datetime


class InitiateUploadResponse(BaseModel):
    upload_id: str
    s3_upload_id: str
    bucket: str
    key: str
    presigned_urls: List[PresignedUrlItem]
    ttl_seconds: int
    created_at: datetime


# ---------------------------------------------------------------------------
# Complete upload
# ---------------------------------------------------------------------------

class PartETag(BaseModel):
    part_number: int = Field(..., ge=1, le=10_000)
    etag: str = Field(..., min_length=1)

    @field_validator("etag")
    @classmethod
    def strip_quotes(cls, v: str) -> str:
        # S3 ETags sometimes come wrapped in quotes from the client
        return v.strip('"').strip("'")


class CompleteUploadRequest(BaseModel):
    upload_id: str
    parts: List[PartETag] = Field(..., min_length=1)
    checksum_sha256: Optional[str] = Field(None, pattern=r"^[a-fA-F0-9]{64}$")

    @field_validator("parts")
    @classmethod
    def parts_must_be_ordered(cls, v: List[PartETag]) -> List[PartETag]:
        sorted_parts = sorted(v, key=lambda p: p.part_number)
        numbers = [p.part_number for p in sorted_parts]
        if numbers != list(range(1, len(numbers) + 1)):
            raise ValueError("Part numbers must be consecutive starting from 1")
        return sorted_parts


class CompleteUploadResponse(BaseModel):
    upload_id: str
    file_key: str
    etag: str
    size_bytes: int
    completed_at: datetime
    status: UploadStatus = UploadStatus.COMPLETED


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

class UploadStatusResponse(BaseModel):
    upload_id: str
    status: UploadStatus
    file_key: str
    filename: str
    size_bytes: int
    parts_total: int
    parts_uploaded: int
    created_at: datetime
    expires_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


class ActiveUploadItem(BaseModel):
    upload_id: str
    status: UploadStatus
    filename: str
    content_type: str
    size_bytes: int
    parts_total: int
    partner_id: str
    created_at: datetime
    expires_at: datetime


class ActiveUploadsResponse(BaseModel):
    uploads: List[ActiveUploadItem]
    count: int


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------

class ErrorResponse(BaseModel):
    code: str
    message: str
    detail: Optional[str] = None
