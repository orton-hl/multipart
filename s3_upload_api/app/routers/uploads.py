"""
Upload router — all /uploads endpoints.

GET    /uploads                → list active uploads
POST   /uploads                → initiate multipart upload
POST   /uploads/complete       → complete multipart upload
GET    /uploads/{id}/status    → poll upload status
GET    /uploads/{id}/part/{n}/refresh  → refresh a single expired presigned URL
DELETE /uploads/{id}           → abort upload
POST   /uploads/cleanup        → manual trigger (admin)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.config import settings
from app.dependencies import get_current_partner
from app.models.upload import (
    ActiveUploadItem,
    ActiveUploadsResponse,
    CompleteUploadRequest,
    CompleteUploadResponse,
    InitiateUploadRequest,
    InitiateUploadResponse,
    PresignedUrlItem,
    UploadStatus,
    UploadStatusResponse,
)
from app.services.s3 import s3_service
from app.services.store import UploadRecord, upload_store

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers / validators
# ---------------------------------------------------------------------------

def _validate_initiate(req: InitiateUploadRequest) -> None:
    if req.file_size_bytes > settings.UPLOAD_MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail={
                "code": "FILE_TOO_LARGE",
                "message": f"File exceeds maximum allowed size of {settings.UPLOAD_MAX_BYTES // 1024**3} GB",
            },
        )
    if req.content_type not in settings.ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "UNSUPPORTED_CONTENT_TYPE",
                "message": f"Content-type '{req.content_type}' is not allowed. "
                           f"Permitted: {settings.ALLOWED_CONTENT_TYPES}",
            },
        )
    if req.part_count > settings.UPLOAD_MAX_PARTS:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_PART_COUNT",
                "message": f"Part count {req.part_count} exceeds S3 limit of {settings.UPLOAD_MAX_PARTS}",
            },
        )


# ---------------------------------------------------------------------------
# POST /uploads  — initiate
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=InitiateUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Initiate a multipart upload",
    responses={
        400: {"description": "Invalid content-type or part count"},
        413: {"description": "File too large"},
    },
)
async def initiate_upload(
    req: InitiateUploadRequest,
    partner: dict = Depends(get_current_partner),
) -> InitiateUploadResponse:
    _validate_initiate(req)

    partner_id = (req.metadata.partner_id if req.metadata else None) or partner.get("sub", "unknown")
    uploaded_by = (req.metadata.uploaded_by if req.metadata else None) or partner.get("email", "")

    # 1. Create multipart upload in S3
    s3_upload_id, key = await s3_service.create_multipart_upload(
        partner_id=partner_id,
        upload_id="tmp",          # placeholder; real ID set after store.put
        filename=req.filename,
        content_type=req.content_type,
        encryption=req.encryption.value,
        metadata={"uploadedBy": uploaded_by},
    )

    # 2. Persist session record
    record = UploadRecord(
        s3_upload_id=s3_upload_id,
        key=key,
        filename=req.filename,
        content_type=req.content_type,
        file_size_bytes=req.file_size_bytes,
        part_count=req.part_count,
        encryption=req.encryption.value,
        partner_id=partner_id,
        uploaded_by=uploaded_by,
        checksum_sha256=req.checksum_sha256,
    )
    await upload_store.put(record)

    # 3. Generate presigned URLs
    presigned_urls = await s3_service.generate_presigned_part_urls(
        s3_upload_id=s3_upload_id,
        key=key,
        part_count=req.part_count,
    )

    logger.info(
        "Upload initiated upload_id=%s partner=%s file=%s size=%d parts=%d",
        record.upload_id, partner_id, req.filename, req.file_size_bytes, req.part_count,
    )

    return InitiateUploadResponse(
        upload_id=record.upload_id,
        s3_upload_id=s3_upload_id,
        bucket=settings.S3_BUCKET,
        key=key,
        presigned_urls=presigned_urls,
        ttl_seconds=settings.PRESIGN_TTL_SECONDS,
        created_at=record.created_at,
    )

# ---------------------------------------------------------------------------
# GET /uploads  — list active uploads
# ---------------------------------------------------------------------------

@router.get(
    "/list-active",
    response_model=ActiveUploadsResponse,
    summary="List all active (in-progress) uploads",
)
async def list_active_uploads(
    partner: dict = Depends(get_current_partner),
) -> ActiveUploadsResponse:
    records = await upload_store.list_active()
    uploads = [
        ActiveUploadItem(
            upload_id=r.upload_id,
            status=r.status,
            filename=r.filename,
            content_type=r.content_type,
            size_bytes=r.file_size_bytes,
            parts_total=r.part_count,
            partner_id=r.partner_id,
            created_at=r.created_at,
            expires_at=r.expires_at,
        )
        for r in records
    ]
    return ActiveUploadsResponse(uploads=uploads, count=len(uploads))

# ---------------------------------------------------------------------------
# POST /uploads/complete  — complete
# ---------------------------------------------------------------------------

@router.post(
    "/complete",
    response_model=CompleteUploadResponse,
    summary="Complete a multipart upload",
    responses={
        400: {"description": "Checksum mismatch or invalid part list"},
        404: {"description": "Upload not found"},
        410: {"description": "Upload expired"},
    },
)
async def complete_upload(
    req: CompleteUploadRequest,
    partner: dict = Depends(get_current_partner),
) -> CompleteUploadResponse:
    record = await upload_store.require(req.upload_id)

    if record.status == UploadStatus.ABORTED:
        raise HTTPException(status_code=410, detail={"code": "UPLOAD_ABORTED", "message": "Upload was aborted"})
    if record.status == UploadStatus.COMPLETED:
        raise HTTPException(status_code=409, detail={"code": "ALREADY_COMPLETED", "message": "Upload already completed"})

    await upload_store.update_status(req.upload_id, UploadStatus.COMPLETING)

    # Build S3-compatible parts list
    parts = [{"PartNumber": p.part_number, "ETag": p.etag} for p in req.parts]

    try:
        s3_response = await s3_service.complete_multipart_upload(
            s3_upload_id=record.s3_upload_id,
            key=record.key,
            parts=parts,
        )
    except Exception as exc:
        await upload_store.update_status(
            req.upload_id, UploadStatus.FAILED, error_message=str(exc)
        )
        raise HTTPException(
            status_code=500,
            detail={"code": "COMPLETE_FAILED", "message": "Failed to complete S3 multipart upload", "detail": str(exc)},
        ) from exc

    etag = s3_response.get("ETag", "")
    await upload_store.update_status(req.upload_id, UploadStatus.COMPLETED, etag=etag)

    size_bytes = await s3_service.get_object_size(record.key)

    logger.info(
        "Upload completed upload_id=%s key=%s etag=%s size=%d",
        req.upload_id, record.key, etag, size_bytes,
    )

    return CompleteUploadResponse(
        upload_id=req.upload_id,
        file_key=record.key,
        etag=etag,
        size_bytes=size_bytes,
        completed_at=datetime.now(timezone.utc),
        status=UploadStatus.COMPLETED,
    )


# ---------------------------------------------------------------------------
# GET /uploads/{upload_id}/status
# ---------------------------------------------------------------------------

@router.get(
    "/{upload_id}/status",
    response_model=UploadStatusResponse,
    summary="Get upload status",
)
async def get_upload_status(
    upload_id: str,
    partner: dict = Depends(get_current_partner),
) -> UploadStatusResponse:
    record = await upload_store.require(upload_id)
    return UploadStatusResponse(
        upload_id=record.upload_id,
        status=record.status,
        file_key=record.key,
        filename=record.filename,
        size_bytes=record.file_size_bytes,
        parts_total=record.part_count,
        parts_uploaded=0,          # extend: track via S3 ListParts or a counter
        created_at=record.created_at,
        expires_at=record.expires_at,
        completed_at=record.completed_at,
        error_message=record.error_message,
    )


# ---------------------------------------------------------------------------
# GET /uploads/{upload_id}/part/{part_number}/refresh
# ---------------------------------------------------------------------------

@router.get(
    "/{upload_id}/part/{part_number}/refresh",
    response_model=PresignedUrlItem,
    summary="Refresh a single expired presigned URL",
)
async def refresh_presigned_url(
    upload_id: str,
    part_number: int,
    partner: dict = Depends(get_current_partner),
) -> PresignedUrlItem:
    record = await upload_store.require(upload_id)

    if record.status != UploadStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail={"code": "UPLOAD_NOT_ACTIVE", "message": "Upload is not in progress"},
        )
    if part_number < 1 or part_number > record.part_count:
        raise HTTPException(status_code=400, detail={"code": "INVALID_PART_NUMBER"})

    urls = await s3_service.generate_presigned_part_urls(
        s3_upload_id=record.s3_upload_id,
        key=record.key,
        part_count=record.part_count,
    )
    # Return just the requested part
    for item in urls:
        if item.part_number == part_number:
            return item

    raise HTTPException(status_code=500, detail="Failed to generate presigned URL")


# ---------------------------------------------------------------------------
# DELETE /uploads/{upload_id}  — abort
# ---------------------------------------------------------------------------

@router.delete(
    "/{upload_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Abort an in-progress upload",
)
async def abort_upload(
    upload_id: str,
    partner: dict = Depends(get_current_partner),
):
    record = await upload_store.require(upload_id)

    if record.status == UploadStatus.COMPLETED:
        raise HTTPException(status_code=409, detail={"code": "ALREADY_COMPLETED"})

    await s3_service.abort_multipart_upload(
        s3_upload_id=record.s3_upload_id,
        key=record.key,
    )
    await upload_store.update_status(upload_id, UploadStatus.ABORTED)
    logger.info("Upload aborted upload_id=%s", upload_id)


# ---------------------------------------------------------------------------
# POST /uploads/cleanup  — manual trigger (admin only)
# ---------------------------------------------------------------------------

@router.post(
    "/cleanup",
    summary="Trigger stale upload cleanup (admin)",
    status_code=status.HTTP_200_OK,
)
async def trigger_cleanup(
    partner: dict = Depends(get_current_partner),
) -> dict:
    stale = await s3_service.list_stale_uploads(max_age_hours=settings.STALE_UPLOAD_HOURS)
    aborted = 0
    errors = 0

    for upload in stale:
        try:
            await s3_service.abort_multipart_upload(
                s3_upload_id=upload["UploadId"],
                key=upload["Key"],
            )
            aborted += 1
            logger.info("Cleaned stale upload key=%s s3_id=%s", upload["Key"], upload["UploadId"])
        except Exception as exc:
            logger.error("Failed to abort stale upload: %s", exc)
            errors += 1

    return {"stale_found": len(stale), "aborted": aborted, "errors": errors}
