#####################################################################################################
## This is a terraform provisioning template to Provision and ECS tasks from the containers defined
## in the container definition json file named s3mig-def.json found in the root directory of this file.
##
## All variables used in this template document have been provided in the terraform.tfvars
## file in the root directory of this file
##
## A lambda function is also triggered to disable cloudwatch event rule after tasks have been
## successfully triggered. This enables tasks to be automatically triggered while ensuring they are
## run just once.
##
## The redis queue has also been mounted on an efs storage to keep queue data persistent after container restart.
#####################################################################################################


# Define local variables to be used in this configuration file.
locals {
  service_name = "s3Mig"
  launch_type = "FARGATE"
  cpu = "1024"
  memory = "4096"
  ecs_consumer_service_name = "s3Mig_consumer_service"
  ecs_producer_service_name = "s3Mig_producer_service"
  ecs_cluster_name = "s3mig_ecs_cluster"
}

# retrieve repository details for containers to be used by tasks

data "aws_ecr_repository" "s3JobProducer" {
  name = var.ECR_S3_JOB_PRODUCER_REPOSITORY_NAME
}

data "aws_ecr_repository" "s3JobConsumer" {
  name = var.ECR_S3_JOB_CONSUMER_REPOSITORY_NAME
}

# Create cloud watch log group to attach to container definition and store events raised by containers

resource "aws_cloudwatch_log_group" "s3Mig" {
  name = local.service_name
  tags = {
    Application = local.service_name
  }
}

# Retrieve container definition details from s3producer-def.json and pass variables defined in terraform to be effected in container definition.

data "template_file" "s3producer" {
  template = file("${path.module}/s3producer-def.json")
  vars = {
    TARGET_S3_BUCKET = var.TARGET_S3_BUCKET
    SOURCE_S3_BUCKET = var.SOURCE_S3_BUCKET
    TARGET_OBJECT_PREFIX = var.TARGET_OBJECT_PREFIX
    TEMP_TABLE_FOR_UPDATE = var.TEMP_TABLE_FOR_UPDATE
    DATABASE_HOST = var.DATABASE_HOST
    DB_USER = var.DB_USER
    DB_PASSWORD = var.DB_PASSWORD
    DATABASE_NAME = var.DATABASE_NAME
    LEGACY_S3_OBJECT_PREFIX = var.LEGACY_S3_OBJECT_PREFIX
    DATABASE_TABLE_TO_UPDATE = var.DATABASE_TABLE_TO_UPDATE
    TABLE_COLUMN_NAME_TO_UPDATE = var.TABLE_COLUMN_NAME_TO_UPDATE
    AWS_REGION = var.AWS_REGION
    S3_PRODUCER_IMAGE_URL = data.aws_ecr_repository.s3JobProducer.repository_url
    S3_CONSUMER_IMAGE_URL = data.aws_ecr_repository.s3JobConsumer.repository_url
    LOG_GROUP = aws_cloudwatch_log_group.s3Mig.name
    LOG_DEF_NAME = local.service_name
    PRODUCER_SERVICE_NAME = local.ecs_producer_service_name
    CONSUMER_SERVICE_NAME = local.ecs_consumer_service_name
    CLUSTER_NAME = local.ecs_cluster_name
  }
}

# Retrieve container definition details from s3JobConsumer-def.json and pass variables defined in terraform to be effected in container definition.

data "template_file" "s3JobConsumer" {
  template = file("${path.module}/s3JobConsumer-def.json")
  vars = {
    TARGET_S3_BUCKET = var.TARGET_S3_BUCKET
    SOURCE_S3_BUCKET = var.SOURCE_S3_BUCKET
    TARGET_OBJECT_PREFIX = var.TARGET_OBJECT_PREFIX
    TEMP_TABLE_FOR_UPDATE = var.TEMP_TABLE_FOR_UPDATE
    DATABASE_HOST = var.DATABASE_HOST
    DB_USER = var.DB_USER
    DB_PASSWORD = var.DB_PASSWORD
    DATABASE_NAME = var.DATABASE_NAME
    LEGACY_S3_OBJECT_PREFIX = var.LEGACY_S3_OBJECT_PREFIX
    DATABASE_TABLE_TO_UPDATE = var.DATABASE_TABLE_TO_UPDATE
    TABLE_COLUMN_NAME_TO_UPDATE = var.TABLE_COLUMN_NAME_TO_UPDATE
    AWS_REGION = var.AWS_REGION
    S3_PRODUCER_IMAGE_URL = data.aws_ecr_repository.s3JobProducer.repository_url
    S3_CONSUMER_IMAGE_URL = data.aws_ecr_repository.s3JobConsumer.repository_url
    LOG_GROUP = aws_cloudwatch_log_group.s3Mig.name
    LOG_DEF_NAME = local.service_name
    REDIS_HOST_NAME = "${aws_service_discovery_service.producer_task.name}.${aws_service_discovery_private_dns_namespace.basetask.name}"
    CONSUMER_SERVICE_NAME = local.ecs_consumer_service_name
    PRODUCER_SERVICE_NAME = local.ecs_producer_service_name
  }
  depends_on = [
    aws_ecs_service.producer_service
  ]
}

# Create cluster to be used for task deployment

resource "aws_ecs_cluster" "cluster" {
  name = local.ecs_cluster_name
}
