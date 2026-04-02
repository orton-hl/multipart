"""
cleanup_handler.py — AWS Lambda function.

Triggered by EventBridge on a daily schedule (cron(0 3 * * ? *)).
Lists all in-progress S3 multipart uploads older than STALE_HOURS
and aborts them, then emits a CloudWatch metric.

Deploy separately from the FastAPI app.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone, timedelta

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

BUCKET = os.environ["BUCKET_NAME"]
PREFIX = os.environ.get("S3_PREFIX", "multipart/")
STALE_HOURS = int(os.environ.get("STALE_HOURS", "24"))
CW_NAMESPACE = os.environ.get("CW_NAMESPACE", "UploadService")


def _emit_metric(name: str, value: float, unit: str = "Count") -> None:
    cw = boto3.client("cloudwatch")
    cw.put_metric_data(
        Namespace=CW_NAMESPACE,
        MetricData=[{
            "MetricName": name,
            "Value": value,
            "Unit": unit,
            "Dimensions": [{"Name": "Environment", "Value": os.environ.get("ENV", "prod")}],
        }],
    )


def handler(event: dict, context) -> dict:
    s3 = boto3.client("s3")
    cutoff = datetime.now(timezone.utc) - timedelta(hours=STALE_HOURS)

    paginator = s3.get_paginator("list_multipart_uploads")
    stale: list[dict] = []

    for page in paginator.paginate(Bucket=BUCKET, Prefix=PREFIX):
        for upload in page.get("Uploads", []):
            initiated: datetime = upload["Initiated"]
            if initiated.tzinfo is None:
                initiated = initiated.replace(tzinfo=timezone.utc)
            if initiated < cutoff:
                stale.append(upload)

    aborted = 0
    errors = 0

    for upload in stale:
        try:
            s3.abort_multipart_upload(
                Bucket=BUCKET,
                Key=upload["Key"],
                UploadId=upload["UploadId"],
            )
            aborted += 1
            logger.info(
                "Aborted stale upload key=%s upload_id=%s initiated=%s",
                upload["Key"],
                upload["UploadId"],
                upload["Initiated"].isoformat(),
            )
        except Exception as exc:
            errors += 1
            logger.error("Failed to abort %s: %s", upload["UploadId"], exc)

    # Emit CloudWatch metrics
    _emit_metric("StaleUploadsFound", len(stale))
    _emit_metric("StaleUploadsAborted", aborted)
    _emit_metric("CleanupErrors", errors)

    logger.info(
        "Cleanup complete: found=%d aborted=%d errors=%d",
        len(stale), aborted, errors,
    )

    return {"stale_found": len(stale), "aborted": aborted, "errors": errors}
