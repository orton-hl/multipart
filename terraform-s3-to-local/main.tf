# =============================================================================
# Root Module — S3 to Local PC via AWS Transfer Family
# =============================================================================

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# -----------------------------------------------------------------------------
# 1. Store the SSH private key in Secrets Manager
# -----------------------------------------------------------------------------
resource "aws_secretsmanager_secret" "sftp_private_key" {
  name                    = "${local.name_prefix}/sftp-private-key"
  description             = "SSH private key for SFTP connector to local PC"
  recovery_window_in_days = 0 # Allow immediate deletion in dev

  tags = {
    Name = "${local.name_prefix}-sftp-private-key"
  }
}

resource "aws_secretsmanager_secret_version" "sftp_private_key" {
  secret_id     = aws_secretsmanager_secret.sftp_private_key.id
  secret_string = file(var.local_sftp_private_key)
}

# -----------------------------------------------------------------------------
# 2. IAM Roles & Policies
# -----------------------------------------------------------------------------
module "iam" {
  source = "./modules/iam"

  name_prefix       = local.name_prefix
  source_bucket_arn = module.s3.bucket_arn
  secret_arn        = aws_secretsmanager_secret.sftp_private_key.arn
  aws_region        = var.aws_region
}

# -----------------------------------------------------------------------------
# 3. S3 Source Bucket with Event Notifications
# -----------------------------------------------------------------------------
module "s3" {
  source = "./modules/s3"

  bucket_name       = var.source_bucket_name
  name_prefix       = local.name_prefix
  lambda_arn        = module.lambda.function_arn
  s3_prefix_filter  = var.s3_prefix_filter
  s3_suffix_filter  = var.s3_suffix_filter
}

# -----------------------------------------------------------------------------
# 4. AWS Transfer Family SFTP Connector
# -----------------------------------------------------------------------------
module "transfer_family" {
  source = "./modules/transfer-family"

  name_prefix       = local.name_prefix
  sftp_host         = var.local_sftp_host
  sftp_port         = var.local_sftp_port
  sftp_user         = var.local_sftp_user
  secret_arn        = aws_secretsmanager_secret.sftp_private_key.arn
  connector_role_arn = module.iam.transfer_connector_role_arn
}

# -----------------------------------------------------------------------------
# 5. Networking (optional VPC for Lambda)
# -----------------------------------------------------------------------------
module "networking" {
  source = "./modules/networking"

  create_vpc  = var.create_vpc
  name_prefix = local.name_prefix
  vpc_cidr    = var.vpc_cidr
  aws_region  = var.aws_region
}

# -----------------------------------------------------------------------------
# 6. Lambda Function — triggered by S3 events, pushes via Transfer Family
# -----------------------------------------------------------------------------
module "lambda" {
  source = "./modules/lambda"

  name_prefix       = local.name_prefix
  lambda_role_arn   = module.iam.lambda_role_arn
  source_bucket_arn = module.s3.bucket_arn
  source_bucket_id  = module.s3.bucket_id
  connector_id      = module.transfer_family.connector_id
  sftp_user         = var.local_sftp_user
  destination_path  = var.local_sftp_destination_path

  # Optional VPC config
  subnet_ids         = module.networking.private_subnet_ids
  security_group_ids = module.networking.lambda_security_group_ids
}
