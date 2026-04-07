variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "s3-to-local"
}

variable "source_bucket_name" {
  description = "Name of the S3 bucket that receives files"
  type        = string
}

variable "s3_prefix_filter" {
  description = "S3 key prefix to filter event notifications (e.g. 'incoming/')"
  type        = string
  default     = ""
}

variable "s3_suffix_filter" {
  description = "S3 key suffix to filter event notifications (e.g. '.csv')"
  type        = string
  default     = ""
}

# --- Local SFTP Server Details ---

variable "local_sftp_host" {
  description = "Public IP or hostname of your local SFTP server"
  type        = string
}

variable "local_sftp_port" {
  description = "SFTP port on your local server"
  type        = number
  default     = 22
}

variable "local_sftp_user" {
  description = "SFTP username on your local server"
  type        = string
}

variable "local_sftp_private_key" {
  description = "Path to the SSH private key file for SFTP authentication"
  type        = string
  sensitive   = true
}

variable "local_sftp_destination_path" {
  description = "Remote directory on your local PC where files will be pushed (e.g. /home/user/incoming)"
  type        = string
  default     = "/home/user/incoming"
}

# --- Networking (optional VPC) ---

variable "create_vpc" {
  description = "Whether to create a VPC for the Lambda function"
  type        = bool
  default     = false
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC (if create_vpc is true)"
  type        = string
  default     = "10.0.0.0/16"
}
