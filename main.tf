#####################################################################################################
## This is a terraform provisioning template to Provision and ECS tasks from the containers defined 
## in the container definition json file named s3mig-def.json found in the root directory of this file.
##
## All variables used in this template document have been provided in the terraform.tfvars 
## file in the root directory of this file
##
## A lambda function is also triggered to diable cloudwatch event rule after tasks have been
## successfully triggered. This enables tasks to be automatically triggered while ensuring they are 
## run just once.
#####################################################################################################


# Define local variables to be used in this configuration file.
locals {
  service_name = "s3Mig"
  launch_type = "FARGATE"
  cpu = "512"
  memory = "1024"
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
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "main" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.0.1.0/24"

  tags = {
    Name = "Main"
  }
}

data "aws_subnet_ids" "subnet" {
  vpc_id = aws_vpc.main.id
  depends_on = [
    aws_subnet.main,
  ]
}

resource "aws_security_group" "ecs_task" {
  name        = "s3MigVPC"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "ecs_task_sg"
  }
}


# Create cloud watch log group to attach to container definition and store events raised by containers

resource "aws_cloudwatch_log_group" "s3Mig" {
  name = local.service_name
  tags = {
    Application = local.service_name
  }
}

# Retrieve container definition details from s3mig-def.json and pass variables defined in terraform to be effected in container definition.

data "template_file" "s3mig" {
  template = file("${path.module}/s3mig-def.json")
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
  }
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
    }
  ]
}
EOF
}

resource "aws_iam_role_policy_attachment" "ecs-task-job-role-policy-attachment" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.ecs_task_role_policy.arn
}

# Create IAM role to be used by ecs event trigger and attach relevant policies to the lambda function

resource "aws_iam_role" "ecs_events" {
  name = "ecs_events"

  assume_role_policy = <<DOC
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "",
      "Effect": "Allow",
      "Principal": {
        "Service": "events.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
DOC
}

resource "aws_iam_policy" "ecs_events_run_task" {
  name = "ecs_events_run_task"
  policy = <<DOC
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "iam:PassRole",
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": "ecs:RunTask",
            "Resource": "${aws_ecs_task_definition.definition.arn}"
        }
    ]
}
DOC
}

resource "aws_iam_role_policy_attachment" "ecs_events_run_task" {
  role       = aws_iam_role.ecs_events.name
  policy_arn = aws_iam_policy.ecs_events_run_task.arn
}

# Create IAM role to be used by lambda function and attach relevant policies to the lambda function

resource "aws_iam_role" "ecs_lambda_events" {
  name = "ecs_lambda_events"

  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "",
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
}

resource "aws_iam_policy" "ecs_lambda_disable_rule" {
  name = "ecs_lambda_events_run_task_with_any_role"
  policy = <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
              "events:DisableRule",
              "logs:CreateLogGroup",
              "logs:CreateLogStream",
              "logs:PutLogEvents"
              ],
            "Resource": "*"
        }
    ]
}
EOF
}

resource "aws_iam_role_policy_attachment" "ecs_lambda_disable_rule" {
  role       = aws_iam_role.ecs_lambda_events.name
  policy_arn = aws_iam_policy.ecs_lambda_disable_rule.arn
}

# Create cluster to be used for task deployment

resource "aws_ecs_cluster" "cluster" {
  name = "${local.service_name}-cluster"
}

# Creat ecs task definition using container definition template retrieved earlier.

resource "aws_ecs_task_definition" "definition" {
  family                   = "${local.service_name}-task-definition"
  container_definitions    = data.template_file.s3mig.rendered
  task_role_arn            = aws_iam_role.ecs_task_role.arn
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  requires_compatibilities = [local.launch_type]
  network_mode             = "awsvpc"
  cpu                      = local.cpu
  memory                   = local.memory
}

# Creat cloudwatch event rule to trigger every minute
# Note this rule will be disabled after its first execution by a lambda function.

resource "aws_cloudwatch_event_rule" "scheduled_task" {
  name                = "scheduled-ecs-event-rule"
  schedule_expression = "cron(* * * * ? *)"
  depends_on = [
    aws_lambda_function.lambda_event_run_task
  ]
}

# Creat cloudwatch event target to trigger ecs target
# This event target will launch the containers using the provided task definition resource

resource "aws_cloudwatch_event_target" "scheduled_task" {
  rule      = aws_cloudwatch_event_rule.scheduled_task.name
  arn       = aws_ecs_cluster.cluster.arn
  role_arn  = aws_iam_role.ecs_events.arn

  ecs_target {
    task_count          = 1
    task_definition_arn = aws_ecs_task_definition.definition.arn
    launch_type         = local.launch_type
    network_configuration {
      subnets          = data.aws_subnet_ids.subnet.ids
      assign_public_ip = false
      security_groups  = [aws_security_group.ecs_task.id]
    }
  }
}

# Creat lambda funtion to disable cloudwatch rule once it is triggered.

resource "aws_lambda_function" "lambda_event_run_task" {
  filename      = "lambdatask.zip"
  function_name = "lambdatasks"
  role          = aws_iam_role.ecs_lambda_events.arn
  handler       = "exports.handler"
  runtime       = "nodejs14.x"

}

# Creat cloudwatch event target to lambda function target
# This lambda event will disable the cloudwatch event rule to avoid repeated tasks deployment.

resource "aws_cloudwatch_event_target" "lambda_disable_rule" {
  target_id = "lambda"
  arn  = aws_lambda_function.lambda_event_run_task.arn
  rule = aws_cloudwatch_event_rule.scheduled_task.name

  input = <<EOF
{
  "rulename": "${aws_cloudwatch_event_rule.scheduled_task.name}"
}
EOF
}

# Creat lambda permission to allow cloudwatch trigger the specified lambda function

resource "aws_lambda_permission" "allow_cloudwatch" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda_event_run_task.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.scheduled_task.arn
}

