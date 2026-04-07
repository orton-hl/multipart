variable "name_prefix" {
  type = string
}

variable "source_bucket_arn" {
  type = string
}

variable "secret_arn" {
  type = string
}

variable "aws_region" {
  type = string
}

# =============================================================================
# Lambda Execution Role
# =============================================================================
data "aws_caller_identity" "current" {}

resource "aws_iam_role" "lambda" {
  name = "${var.name_prefix}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Allow Lambda to read from S3
resource "aws_iam_role_policy" "lambda_s3" {
  name = "${var.name_prefix}-lambda-s3"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:ListBucket"
        ]
        Resource = [
          var.source_bucket_arn,
          "${var.source_bucket_arn}/*"
        ]
      }
    ]
  })
}

# Allow Lambda to use Transfer Family connector
resource "aws_iam_role_policy" "lambda_transfer" {
  name = "${var.name_prefix}-lambda-transfer"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "transfer:StartFileTransfer",
          "transfer:DescribeConnector",
          "transfer:ListConnectors"
        ]
        Resource = "arn:aws:transfer:${var.aws_region}:${data.aws_caller_identity.current.account_id}:connector/*"
      }
    ]
  })
}

# CloudWatch Logs
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# VPC access (if Lambda runs in VPC)
resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# =============================================================================
# Transfer Family Connector Role
# =============================================================================
resource "aws_iam_role" "transfer_connector" {
  name = "${var.name_prefix}-transfer-connector-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "transfer.amazonaws.com"
        }
      }
    ]
  })
}

# Allow Transfer connector to read S3 objects
resource "aws_iam_role_policy" "transfer_s3" {
  name = "${var.name_prefix}-transfer-s3"
  role = aws_iam_role.transfer_connector.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:ListBucket",
          "s3:PutObject"
        ]
        Resource = [
          var.source_bucket_arn,
          "${var.source_bucket_arn}/*"
        ]
      }
    ]
  })
}

# Allow Transfer connector to read the SSH key from Secrets Manager
resource "aws_iam_role_policy" "transfer_secrets" {
  name = "${var.name_prefix}-transfer-secrets"
  role = aws_iam_role.transfer_connector.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = var.secret_arn
      }
    ]
  })
}

# =============================================================================
# Outputs
# =============================================================================
output "lambda_role_arn" {
  value = aws_iam_role.lambda.arn
}

output "transfer_connector_role_arn" {
  value = aws_iam_role.transfer_connector.arn
}
