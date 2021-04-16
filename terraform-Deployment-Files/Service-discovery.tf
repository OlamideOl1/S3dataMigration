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
