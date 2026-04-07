# S3-to-Local PC File Push via AWS Transfer Family

## Architecture Overview

```
┌──────────┐   S3 Event     ┌────────┐   SFTP Push    ┌──────────────────┐
│  S3      │ ──────────────►│ Lambda │ ─────────────► │ AWS Transfer     │
│  Bucket  │  (ObjectCreated)│        │  (via SFTP     │ Family SFTP      │
└──────────┘                └────────┘   Connector)    │ Connector        │
                                                       └────────┬─────────┘
                                                                │
                                                         SFTP Push to
                                                         your local
                                                         SFTP server
                                                                │
                                                       ┌────────▼─────────┐
                                                       │  Your Local PC   │
                                                       │  (SFTP Server)   │
                                                       └──────────────────┘
```

## How It Works

1. A file is uploaded to the S3 source bucket.
2. S3 sends an event notification to a Lambda function.
3. The Lambda function downloads the file from S3.
4. Lambda uses the **AWS Transfer Family SFTP Connector** to push the file to your local PC.
5. Your local PC runs an SFTP server (e.g., OpenSSH) that receives the file.

## Prerequisites

- **Terraform >= 1.5**
- **AWS CLI** configured with appropriate credentials
- **An SFTP server running on your local PC** (OpenSSH, WinSCP, etc.)
- **A public IP or domain** for your local PC (or use a VPN/tunnel like ngrok, Tailscale, etc.)
- **SSH key pair** for SFTP authentication

## Quick Start

### 1. Set Up Your Local SFTP Server

**Linux/macOS (OpenSSH):**
```bash
# OpenSSH sshd usually supports SFTP out of the box
sudo systemctl enable ssh
sudo systemctl start ssh
```

**Windows (OpenSSH):**
```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
```

### 2. Generate SSH Keys

```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/transfer_family_key -N ""
```

Place the **public key** on your local SFTP server's `~/.ssh/authorized_keys`.

### 3. Configure Terraform

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
```

### 4. Deploy

```bash
terraform init
terraform plan
terraform apply
```

### 5. Test

Upload a file to the S3 bucket:
```bash
aws s3 cp test-file.txt s3://<your-bucket-name>/incoming/
```

The file should appear on your local PC in the configured directory.

## Network Considerations

Your local PC must be reachable from AWS. Options:

| Method         | Description                                    |
|----------------|------------------------------------------------|
| Public IP      | Direct connection (configure firewall for port 22) |
| Tailscale VPN  | Mesh VPN — no port forwarding needed           |
| ngrok          | Tunnel with a stable TCP endpoint              |
| AWS Site-to-Site VPN | Enterprise VPN connection                |
| AWS Direct Connect   | Dedicated network link                    |

## File Structure

```
.
├── main.tf                  # Root module — wires everything together
├── variables.tf             # Input variables
├── outputs.tf               # Output values
├── terraform.tfvars.example # Example variable values
├── provider.tf              # AWS provider config
├── modules/
│   ├── s3/                  # S3 bucket + event notification
│   ├── lambda/              # Lambda function for file transfer
│   ├── transfer-family/     # AWS Transfer Family SFTP connector
│   ├── iam/                 # IAM roles and policies
│   └── networking/          # Security groups
└── scripts/
    └── push_file.py         # Lambda function source code
```

## Cleanup

```bash
terraform destroy
```

## Security Notes

- SSH private keys are stored in AWS Secrets Manager.
- Lambda runs inside a VPC with controlled egress (optional).
- S3 bucket has versioning and encryption enabled.
- All IAM policies follow least-privilege principles.
