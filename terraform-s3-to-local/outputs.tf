output "source_bucket_name" {
  description = "S3 bucket name — upload files here to trigger the pipeline"
  value       = module.s3.bucket_id
}

output "source_bucket_arn" {
  description = "S3 bucket ARN"
  value       = module.s3.bucket_arn
}

output "transfer_connector_id" {
  description = "AWS Transfer Family SFTP Connector ID"
  value       = module.transfer_family.connector_id
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = module.lambda.function_name
}

output "lambda_function_arn" {
  description = "Lambda function ARN"
  value       = module.lambda.function_arn
}

output "upload_test_command" {
  description = "Test command — upload a file to trigger the pipeline"
  value       = "aws s3 cp test.txt s3://${module.s3.bucket_id}/${var.s3_prefix_filter}"
}
