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
