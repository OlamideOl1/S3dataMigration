
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
