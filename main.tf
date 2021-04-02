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

# Create networking resources to be used for ecs tasks.

resource "aws_vpc" "main" {
  cidr_block = "172.17.0.0/16"
  enable_dns_support = true
  enable_dns_hostnames = true
}

resource "aws_subnet" "main" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "172.17.1.0/24"

  tags = {
    Name = "Main"
  }
}

resource "aws_internet_gateway" "ig" {
  vpc_id = aws_vpc.main.id
}

resource "aws_route" "default_route" {
  route_table_id         = aws_vpc.main.default_route_table_id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.ig.id
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

# Create IAM role for ecs task execution and attach relevant policies to the ecs execution role

resource "aws_iam_role" "ecs_task_execution_role" {
  name = "role-execution-name"
  assume_role_policy = <<EOF
{
 "Version": "2012-10-17",
 "Statement": [
   {
     "Action": "sts:AssumeRole",
     "Principal": {
       "Service": "ecs-tasks.amazonaws.com"
     },
     "Effect": "Allow",
     "Sid": ""
   }
 ]
}
EOF
}

resource "aws_iam_role_policy_attachment" "ecs-task-execution-role-policy-attachment" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Create IAM role to be used by each task i.e the containers and attach relevant policies to the ecs task role.
# This role also enables the containers access the relevant S3 buckets for migration.

resource "aws_iam_role" "ecs_task_role" {
  name = "role-name-task"
  assume_role_policy = <<EOF
{
 "Version": "2012-10-17",
 "Statement": [
   {
     "Action": "sts:AssumeRole",
     "Principal": {
       "Service": "ecs-tasks.amazonaws.com"
     },
     "Effect": "Allow",
     "Sid": ""
   }
 ]
}
EOF
}

// This iam policy provides access to the source and target buckets
// This iam polic also provides access to the s3JobConsumer so it can set desired task count to 0 when migration is completed

resource "aws_iam_policy" "ecs_task_role_policy" {
  name = "ecs_task_role_policy"
  description = "IAM Policy for ecs task operation"
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Stmt1615557370374",
      "Action": [
        "s3:GetObject",
        "s3:GetObjectTagging",
        "s3:ListBucket",
        "s3:PutObject",
        "s3:PutObjectTagging"
      ],
      "Effect": "Allow",
      "Resource": [
        "arn:aws:s3:::${var.SOURCE_S3_BUCKET}",
        "arn:aws:s3:::${var.SOURCE_S3_BUCKET}/*",
        "arn:aws:s3:::${var.TARGET_S3_BUCKET}/*",
        "arn:aws:s3:::${var.TARGET_S3_BUCKET}"
      ]
    },
    {
      "Sid": "Stmt1617296973068",
      "Action": [
        "ecs:UpdateService",
        "ecs:StopTask"
      ],
      "Effect": "Allow",
      "Resource": "*"
    }
  ]
}
EOF
}

resource "aws_iam_role_policy_attachment" "ecs-task-job-role-policy-attachment" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.ecs_task_role_policy.arn
}

# Create cluster to be used for task deployment

resource "aws_ecs_cluster" "cluster" {
  name = local.ecs_cluster_name
}

# Creat ecs task definition using container definition template retrieved earlier.
# This task also has support for efs. EFS has been mounted on the redis container
# The redis container will now persist data to the efs storage.

resource "aws_ecs_task_definition" "producer_definition" {
  family                   = "${local.service_name}-task-definition"
  container_definitions    = data.template_file.s3producer.rendered
  task_role_arn            = aws_iam_role.ecs_task_role.arn
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  requires_compatibilities = [local.launch_type]
  network_mode             = "awsvpc"
  cpu                      = local.cpu
  memory                   = local.memory
  volume {
    name = "task-efs"

    efs_volume_configuration {
      file_system_id          = aws_efs_file_system.fs.id
      authorization_config {
          iam = null
          access_point_id  = null
        }
        transit_encryption = "ENABLED"
      root_directory  = "/opt/data"
    }
  }
  depends_on = [
    aws_efs_mount_target.task
  ]
}

resource "aws_ecs_task_definition" "s3JobConsumer_definition" {
  family                   = "${local.service_name}-s3JobConsumer_definition"
  container_definitions    = data.template_file.s3JobConsumer.rendered
  task_role_arn            = aws_iam_role.ecs_task_role.arn
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  requires_compatibilities = [local.launch_type]
  network_mode             = "awsvpc"
  cpu                      = local.cpu
  memory                   = local.memory
  depends_on = [
    aws_ecs_service.producer_service,
    aws_security_group.producer_task,
    aws_service_discovery_service.producer_task,
    aws_ecs_task_definition.producer_definition,
    aws_efs_mount_target.task
  ]
}

// service descovery resources

resource "aws_service_discovery_private_dns_namespace" "basetask" {
  name        = "local.com"
  description = "s3_consumer_task"
  vpc         = aws_vpc.main.id

}

resource "aws_service_discovery_service" "producer_task" {
  name = "producer"
  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.basetask.id
    dns_records {
      ttl  = 10
      type = "A"
    }
    routing_policy = "MULTIVALUE"
  }
  health_check_custom_config {
    failure_threshold = 4
  }
}

resource "aws_security_group" "producer_task" {
  name        = "${local.service_name}_producer_task_sg"
  description = "allow inbound access to producer on redis port"
  vpc_id      = aws_vpc.main.id

// Ingress rule for Redis server
  ingress {
  from_port       = 6379
  to_port         = 6379
  protocol        = "tcp"
  # cidr_blocks     = ["0.0.0.0/0"]
  cidr_blocks     = [aws_vpc.main.cidr_block]
}

// Ingress rule for EFS
ingress {
from_port       = 2049
to_port         = 2049
protocol        = "tcp"
cidr_blocks     = [aws_vpc.main.cidr_block]
}

  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}


resource "aws_security_group" "consumer_task" {
  name        = "${local.service_name}_consumer_task_sg"
  description = "allow access to producer on redis port"
  vpc_id      = aws_vpc.main.id

  ingress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0

    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0

    cidr_blocks = ["0.0.0.0/0"]
  }
  depends_on = [
    aws_ecs_service.producer_service,
    aws_security_group.producer_task,
    aws_service_discovery_service.producer_task,
    aws_ecs_task_definition.producer_definition,
    aws_efs_mount_target.task
  ]

}

// create ecs service for producer

resource "aws_ecs_service" "producer_service" {
  name            = local.ecs_producer_service_name
  cluster         = aws_ecs_cluster.cluster.id
  task_definition = aws_ecs_task_definition.producer_definition.arn
  desired_count   = 1
  launch_type     = local.launch_type

  network_configuration {
    security_groups  = [aws_security_group.producer_task.id]
    subnets          = aws_subnet.main.*.id
    assign_public_ip = true
  }

  service_registries {
      registry_arn = aws_service_discovery_service.producer_task.arn
      container_name = "redis"
  }
  depends_on = [
    aws_efs_mount_target.task
  ]

}

// create ecs service for consumer
resource "aws_ecs_service" "consumer_service" {
  name            = local.ecs_consumer_service_name
  cluster         = aws_ecs_cluster.cluster.id
  task_definition = aws_ecs_task_definition.s3JobConsumer_definition.arn
  desired_count   = var.CONSUMER_TASK_COUNT
  launch_type     = local.launch_type

  network_configuration {
    security_groups  = [aws_security_group.consumer_task.id]
    subnets          = aws_subnet.main.*.id
    assign_public_ip = true
  }

  depends_on = [
    aws_ecs_service.producer_service,
    aws_security_group.producer_task,
    aws_service_discovery_service.producer_task,
    aws_efs_mount_target.task
  ]
}

# EFS Related Configuration are placed below.

resource "aws_efs_file_system" "fs" {
  creation_token = "task-efs"
  encrypted = false
  throughput_mode = "bursting"
  performance_mode = "generalPurpose"
  tags = {
    Name = "task_fs"
  }
}

# Degine Policy for using efs storage

resource "aws_efs_file_system_policy" "policy" {
  file_system_id = aws_efs_file_system.fs.id

  policy = <<POLICY
{
    "Version": "2012-10-17",
    "Id": "ExamplePolicy01",
    "Statement": [
        {
            "Sid": "ExampleStatement01",
            "Effect": "Allow",
            "Principal": {
                "AWS": "*"
            },
            "Resource": "${aws_efs_file_system.fs.arn}",
            "Action": [
                "elasticfilesystem:ClientMount",
                "elasticfilesystem:ClientWrite",
                "elasticfilesystem:ClientRootAccess"
            ],
            "Condition": {
                "Bool": {
                    "aws:SecureTransport": "true"
                }
            }
        }
    ]
}
POLICY
}

# Create efs mount target

resource "aws_efs_mount_target" "task" {
  file_system_id = aws_efs_file_system.fs.id
  subnet_id      = aws_subnet.main.id
  security_groups = [aws_security_group.producer_task.id]
}


# Create efs security group

resource "aws_security_group" "efs" {
  name        = "efs"
  vpc_id      = aws_vpc.main.id

  ingress {
          description = "nfs"
          from_port = 2049
          to_port = 2049
          protocol = "tcp"
          cidr_blocks = [aws_vpc.main.cidr_block]
      }

    egress {
     from_port       = 0
     to_port         = 0
     protocol        = "-1"
     cidr_blocks     = ["0.0.0.0/0"]
   }
  tags = {
    Name = "efs_sg"
  }
}
