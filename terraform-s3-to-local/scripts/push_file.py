"""
Lambda function triggered by S3 ObjectCreated events.

Uses AWS Transfer Family's StartFileTransfer API to push the newly
uploaded S3 object to the configured remote SFTP server (your local PC).
"""

import json
import logging
import os
import urllib.parse

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

transfer_client = boto3.client("transfer")

CONNECTOR_ID = os.environ["CONNECTOR_ID"]
DESTINATION_PATH = os.environ["DESTINATION_PATH"]
SFTP_USER = os.environ.get("SFTP_USER", "")


def handler(event, context):
    """
    Process S3 event records and initiate file transfers via the
    AWS Transfer Family SFTP Connector.
    """
    logger.info("Received event: %s", json.dumps(event, default=str))

    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        key = urllib.parse.unquote_plus(record["s3"]["object"]["key"])
        size = record["s3"]["object"].get("size", 0)

        logger.info(
            "Processing: bucket=%s, key=%s, size=%d bytes",
            bucket, key, size,
        )

        # Skip folder markers
        if key.endswith("/"):
            logger.info("Skipping folder marker: %s", key)
            continue

        # Build the S3 source path (Transfer Family format)
        source_path = f"/{bucket}/{key}"

        # Extract just the filename for the destination
        filename = key.split("/")[-1]
        remote_path = f"{DESTINATION_PATH}/{filename}"

        try:
            response = transfer_client.start_file_transfer(
                ConnectorId=CONNECTOR_ID,
                SendFilePaths=[source_path],
                RetrieveFilePaths=[],  # We are sending, not retrieving
            )

            transfer_id = response.get("TransferId", "unknown")
            logger.info(
                "Transfer initiated: transfer_id=%s, source=%s, connector=%s",
                transfer_id, source_path, CONNECTOR_ID,
            )

        except Exception as e:
            logger.error(
                "Failed to initiate transfer for %s: %s",
                source_path, str(e),
            )
            raise

    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": f"Processed {len(event.get('Records', []))} records",
        }),
    }
