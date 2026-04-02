"""
S3Service: wraps all boto3 multipart-upload operations.

Responsibilities:
  - create_multipart_upload       → get s3UploadId
  - generate_presigned_part_urls  → per-part PUT URLs
  - complete_multipart_upload     → assemble object
  - abort_multipart_upload        → discard parts
  - list_stale_uploads            → for cleanup Lambda
  - validate_credentials          → startup health check
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import List

import aioboto3
from botocore.exceptions import ClientError

from app.config import settings
from app.models.upload import PresignedUrlItem

logger = logging.getLogger(__name__)


class S3Service:
    def __init__(self):
        self._session = aioboto3.Session()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _s3_key(self, partner_id: str, upload_id: str, filename: str) -> str:
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return f"{settings.S3_PREFIX}/{partner_id}/{date_str}/{upload_id}/{filename}"

    def _encryption_args(self, encryption: str) -> dict:
        if encryption == "SSE-KMS" and settings.KMS_KEY_ID:
            return {
                "ServerSideEncryption": "aws:kms",
                "SSEKMSKeyId": settings.KMS_KEY_ID,
            }
        return {"ServerSideEncryption": "AES256"}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def validate_credentials(self) -> None:
        """Called at startup — will raise if AWS creds are misconfigured."""
        async with self._session.client("sts", region_name=settings.AWS_REGION) as sts:
            identity = await sts.get_caller_identity()
            logger.info("AWS identity confirmed: %s", identity.get("Arn"))

    async def create_multipart_upload(
        self,
        partner_id: str,
        upload_id: str,
        filename: str,
        content_type: str,
        encryption: str,
        metadata: dict | None = None,
    ) -> tuple[str, str]:
        """
        Returns (s3_upload_id, s3_key).
        """
        key = self._s3_key(partner_id, upload_id, filename)
        enc_args = self._encryption_args(encryption)
        extra_meta = {
            "upload-id": upload_id,
            "partner-id": partner_id,
            **(metadata or {}),
        }

        async with self._session.client("s3", region_name=settings.AWS_REGION) as s3:
            response = await s3.create_multipart_upload(
                Bucket=settings.S3_BUCKET,
                Key=key,
                ContentType=content_type,
                Metadata=extra_meta,
                **enc_args,
            )

        s3_upload_id = response["UploadId"]
        logger.info("Created multipart upload s3_id=%s key=%s", s3_upload_id, key)
        return s3_upload_id, key

    async def generate_presigned_part_urls(
        self,
        s3_upload_id: str,
        key: str,
        part_count: int,
    ) -> List[PresignedUrlItem]:
        """
        Generate one presigned PUT URL per part.
        """
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.PRESIGN_TTL_SECONDS)
        urls: List[PresignedUrlItem] = []

        async with self._session.client("s3", region_name=settings.AWS_REGION) as s3:
            for part_number in range(1, part_count + 1):
                url = await s3.generate_presigned_url(
                    "upload_part",
                    Params={
                        "Bucket": settings.S3_BUCKET,
                        "Key": key,
                        "UploadId": s3_upload_id,
                        "PartNumber": part_number,
                    },
                    ExpiresIn=settings.PRESIGN_TTL_SECONDS,
                )
                urls.append(PresignedUrlItem(
                    part_number=part_number,
                    url=url,
                    expires_at=expires_at,
                ))

        logger.info("Generated %d presigned URLs for s3_id=%s", part_count, s3_upload_id)
        return urls

    async def complete_multipart_upload(
        self,
        s3_upload_id: str,
        key: str,
        parts: list[dict],  # [{"PartNumber": int, "ETag": str}]
    ) -> dict:
        """
        Calls S3 CompleteMultipartUpload.
        Returns the S3 response including ETag and Location.
        """
        async with self._session.client("s3", region_name=settings.AWS_REGION) as s3:
            response = await s3.complete_multipart_upload(
                Bucket=settings.S3_BUCKET,
                Key=key,
                UploadId=s3_upload_id,
                MultipartUpload={"Parts": parts},
            )

        logger.info("Completed multipart upload s3_id=%s key=%s", s3_upload_id, key)
        return response

    async def abort_multipart_upload(self, s3_upload_id: str, key: str) -> None:
        async with self._session.client("s3", region_name=settings.AWS_REGION) as s3:
            await s3.abort_multipart_upload(
                Bucket=settings.S3_BUCKET,
                Key=key,
                UploadId=s3_upload_id,
            )
        logger.info("Aborted multipart upload s3_id=%s", s3_upload_id)

    async def get_object_size(self, key: str) -> int:
        """Head-object to get assembled file size after completion."""
        async with self._session.client("s3", region_name=settings.AWS_REGION) as s3:
            try:
                resp = await s3.head_object(Bucket=settings.S3_BUCKET, Key=key)
                return resp["ContentLength"]
            except ClientError:
                return 0

    async def list_stale_uploads(self, max_age_hours: int = 24) -> list[dict]:
        """
        Returns all in-progress multipart uploads older than max_age_hours.
        Used by the cleanup Lambda / scheduled job.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
        stale = []

        async with self._session.client("s3", region_name=settings.AWS_REGION) as s3:
            paginator = s3.get_paginator("list_multipart_uploads")
            async for page in paginator.paginate(
                Bucket=settings.S3_BUCKET,
                Prefix=settings.S3_PREFIX + "/",
            ):
                for upload in page.get("Uploads", []):
                    if upload["Initiated"] < cutoff:
                        stale.append(upload)

        return stale


# Singleton
s3_service = S3Service()
