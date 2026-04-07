variable "name_prefix" {
  type = string
}

variable "lambda_role_arn" {
  type = string
}

variable "source_bucket_arn" {
  type = string
}

variable "source_bucket_id" {
  type = string
}

variable "connector_id" {
  type = string
}

variable "sftp_user" {
  type = string
}

variable "destination_path" {
  type = string
}

variable "subnet_ids" {
  type    = list(string)
  default = []
}

variable "security_group_ids" {
  type    = list(string)
  default = []
}

# =============================================================================
# Package Lambda Code
# =============================================================================
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.root}/scripts/push_file.py"
  output_path = "${path.root}/.terraform/tmp/push_file.zip"
}

# =============================================================================
# Lambda Function
# =============================================================================
resource "aws_lambda_function" "push_file" {
  function_name    = "${var.name_prefix}-push-file"
  role             = var.lambda_role_arn
  handler          = "push_file.handler"
  runtime          = "python3.12"
  timeout          = 120
  memory_size      = 256
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      CONNECTOR_ID     = var.connector_id
      DESTINATION_PATH = var.destination_path
      SFTP_USER        = var.sftp_user
    }
  }

  # Optional VPC configuration
  dynamic "vpc_config" {
    for_each = length(var.subnet_ids) > 0 ? [1] : []

    content {
      subnet_ids         = var.subnet_ids
      security_group_ids = var.security_group_ids
    }
  }

  tags = {
    Name = "${var.name_prefix}-push-file"
  }
}

# =============================================================================
# CloudWatch Log Group (explicit, with retention)
# =============================================================================
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${aws_lambda_function.push_file.function_name}"
  retention_in_days = 14

  tags = {
    Name = "${var.name_prefix}-lambda-logs"
  }
}

# =============================================================================
# Outputs
# =============================================================================
output "function_arn" {
  value = aws_lambda_function.push_file.arn
}

output "function_name" {
  value = aws_lambda_function.push_file.function_name
}
