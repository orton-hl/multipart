variable "name_prefix" {
  type = string
}

variable "sftp_host" {
  type = string
}

variable "sftp_port" {
  type    = number
  default = 22
}

variable "sftp_user" {
  type = string
}

variable "secret_arn" {
  type = string
}

variable "connector_role_arn" {
  type = string
}

# =============================================================================
# AWS Transfer Family SFTP Connector
#
# This connector allows AWS to initiate outbound SFTP connections to your
# local PC's SFTP server and push files to it.
# =============================================================================

resource "aws_transfer_connector" "sftp_to_local" {
  url = "sftp://${var.sftp_host}:${var.sftp_port}"

  access_role = var.connector_role_arn

  sftp_config {
    user_secret_id    = var.secret_arn
    trusted_host_keys = [] # Populate after first connection or use known host keys
  }

  tags = {
    Name = "${var.name_prefix}-sftp-connector"
  }
}

# =============================================================================
# Outputs
# =============================================================================
output "connector_id" {
  value = aws_transfer_connector.sftp_to_local.id
}

output "connector_arn" {
  value = aws_transfer_connector.sftp_to_local.arn
}
