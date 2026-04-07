variable "bucket_name" {
  type = string
}

variable "name_prefix" {
  type = string
}

variable "lambda_arn" {
  type = string
}

variable "s3_prefix_filter" {
  type    = string
  default = ""
}

variable "s3_suffix_filter" {
  type    = string
  default = ""
}

# =============================================================================
# S3 Bucket
# =============================================================================
resource "aws_s3_bucket" "source" {
  bucket = var.bucket_name

  tags = {
    Name = "${var.name_prefix}-source-bucket"
  }
}

resource "aws_s3_bucket_versioning" "source" {
  bucket = aws_s3_bucket.source.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "source" {
  bucket = aws_s3_bucket.source.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "source" {
  bucket = aws_s3_bucket.source.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# =============================================================================
# S3 Event Notification → Lambda
# =============================================================================
resource "aws_lambda_permission" "s3_invoke" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_arn
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.source.arn
}

resource "aws_s3_bucket_notification" "trigger" {
  bucket = aws_s3_bucket.source.id

  lambda_function {
    lambda_function_arn = var.lambda_arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = var.s3_prefix_filter
    filter_suffix       = var.s3_suffix_filter
  }

  depends_on = [aws_lambda_permission.s3_invoke]
}

# =============================================================================
# Outputs
# =============================================================================
output "bucket_arn" {
  value = aws_s3_bucket.source.arn
}

output "bucket_id" {
  value = aws_s3_bucket.source.id
}
