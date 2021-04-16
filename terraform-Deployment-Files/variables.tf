variable "SOURCE_S3_BUCKET" {
}

variable "TARGET_S3_BUCKET" {
}

variable "AWS_REGION" {
  default = "us-east-1"
}

variable "TARGET_OBJECT_PREFIX" {
}

variable "TEMP_TABLE_FOR_UPDATE" {
  default = "tempTableforUpdate"
}

variable "DATABASE_HOST" {
}

variable "DB_USER" {
}

variable "DB_PASSWORD" {
}

variable "DATABASE_NAME" {
}

variable "LEGACY_S3_OBJECT_PREFIX" {
}

variable "DATABASE_TABLE_TO_UPDATE" {
}

variable "TABLE_COLUMN_NAME_TO_UPDATE" {
}

variable "ECR_S3_JOB_PRODUCER_REPOSITORY_NAME" {
}

variable "ECR_S3_JOB_CONSUMER_REPOSITORY_NAME" {
}

variable "CONSUMER_TASK_COUNT" {
  default = 1
}
