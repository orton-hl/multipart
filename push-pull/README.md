# Pushing files from S3 to on-prem servers using AWS Transfer Family

> **Status:** Published · **Owner:** Cloud Infrastructure Team · **Last updated:** 02 Apr 2026

## Overview

This repository contains the technical documentation for an event-driven file transfer pattern that automatically pushes newly uploaded files from an Amazon S3 bucket to an on-premises SFTP/FTPS server using AWS Transfer Family.

The companion HTML file (`s3-to-onprem-transfer-family.html`) is a self-contained Confluence-style page with embedded architecture and sequence diagrams, ready to be opened in any browser or imported into a wiki.

## Architecture summary

```
┌──────────────────── AWS Cloud ─────────────────────┐   ┌─── On-prem ───┐
│                                                     │   │               │
│  S3 Bucket ──► EventBridge ──► Lambda               │   │               │
│  /outbound/     (Object         (Orchestration)     │   │  SFTP Server  │
│                  Created)           │                │   │  (port 22)    │
│                                     ▼                │   │      ▲        │
│                              Transfer Family ────────┼───┼──────┘        │
│                              (SFTP Connector)        │   │  Direct       │
│                                                     │   │  Connect/VPN  │
│  KMS │ Secrets Manager │ CloudWatch │ SNS            │   │               │
└─────────────────────────────────────────────────────┘   └───────────────┘
```

### Data flow

1. An upstream application uploads a file to the S3 bucket under the `/outbound/` prefix.
2. S3 emits an `s3:ObjectCreated` event routed via EventBridge (or S3 Event Notifications).
3. An AWS Lambda function validates the file and calls the Transfer Family `StartFileTransfer` API.
4. The Transfer Family SFTP connector reads the file from S3 and pushes it to the on-prem server over SFTP, traversing Direct Connect or Site-to-Site VPN.
5. On success the file is archived to `/archive/`; on failure it is moved to `/failed/` and an SNS alert is published.

## Key components

| Component | Purpose |
|---|---|
| **Amazon S3** | Source bucket with SSE-KMS encryption and EventBridge notifications enabled |
| **Amazon EventBridge** | Event routing with content-based filtering, archive, and replay |
| **AWS Lambda** | Orchestration — validation, deduplication, invocation of Transfer Family |
| **AWS Transfer Family** | Managed SFTP connector for outbound file push |
| **AWS Secrets Manager** | Stores SFTP credentials with automatic 90-day rotation |
| **AWS KMS** | Customer-managed key for S3 encryption and Secrets Manager |
| **CloudWatch** | Logs and alarms for Lambda, Transfer Family, and EventBridge |
| **SNS** | Failure alerting to PagerDuty / Slack |

## Security

- **IAM:** Least-privilege roles for Lambda and the Transfer Family connector. No wildcards.
- **Network:** Connector runs in a VPC with security groups scoped to the on-prem SFTP IP. Connectivity via Direct Connect or Site-to-Site VPN — never the public internet.
- **Credentials:** SFTP credentials stored in Secrets Manager (never in code or env vars). Automatic 90-day rotation.
- **Host key verification:** The connector validates the on-prem server's SSH host key on every connection.
- **Bucket policy:** Restricts access to Lambda and Transfer Family role ARNs only. Enforces `aws:SecureTransport`.

## Encryption

| Layer | Mechanism |
|---|---|
| At-rest (S3) | SSE-KMS with customer-managed key |
| In-transit (S3 → Transfer Family) | TLS 1.2+ (HTTPS) |
| In-transit (Transfer Family → on-prem) | SFTP (SSH) or FTPS (TLS 1.2+) |
| Secrets at-rest | Secrets Manager encrypted with a dedicated KMS key |

## Logging & monitoring

| Source | Destination |
|---|---|
| S3 server access logs | Dedicated logging bucket |
| CloudTrail data events | CloudTrail bucket + CloudWatch Logs |
| Transfer Family structured logs | CloudWatch Logs `/aws/transfer/` |
| Lambda function logs | CloudWatch Logs `/aws/lambda/` |
| EventBridge metrics | CloudWatch Metrics + SQS DLQ |

### Recommended alarms

- Transfer Family connector execution `EXCEPTION` — any occurrence
- Lambda `Errors` metric — > 0 in 5 minutes
- EventBridge DLQ age — > 15 minutes
- Transfer duration — > 5 minutes per file

## Error handling & retry

| Layer | Behaviour |
|---|---|
| EventBridge → Lambda | Retries for 24h with exponential backoff; failed events go to SQS DLQ |
| Lambda → Transfer Family | 3 retries with exponential backoff (2s, 4s, 8s) |
| Transfer Family → on-prem | Managed connector retries SFTP connection up to 3 times |

Failed files are moved to `/failed/` with metadata tags. A daily scheduled Lambda reports on failures and optionally re-queues files.

The Lambda must be **idempotent** — use S3 ETag or a DynamoDB deduplication table to avoid duplicate transfers from at-least-once event delivery.

## Prerequisites checklist

- [ ] S3 bucket with SSE-KMS, versioning, and EventBridge notifications
- [ ] Transfer Family SFTP connector in target VPC with host key registered
- [ ] SFTP credentials in Secrets Manager with 90-day rotation
- [ ] Direct Connect or Site-to-Site VPN verified
- [ ] On-prem firewall allows inbound SFTP from connector IP range
- [ ] Least-privilege IAM roles for Lambda and Transfer Family
- [ ] EventBridge rule with DLQ configured
- [ ] CloudWatch alarms + SNS topic for alerts
- [ ] CloudTrail data events enabled on S3 bucket
- [ ] Transfer Family structured logging enabled
- [ ] End-to-end test with sample file completed

## Files

| File | Description |
|---|---|
| `s3-to-onprem-transfer-family.html` | Self-contained Confluence-style page with embedded SVG architecture and sequence diagrams. Open in any browser. Supports light and dark mode. |
| `README.md` | This file — plain-text overview for Git repositories and quick reference. |

## Related resources

- [AWS Transfer Family — SFTP Connectors](https://docs.aws.amazon.com/transfer/latest/userguide/connectors-sftp.html)
- [Amazon S3 Event Notifications with EventBridge](https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventBridge.html)
- [StartFileTransfer API reference](https://docs.aws.amazon.com/transfer/latest/userguide/API_StartFileTransfer.html)
