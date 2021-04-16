// security group definition for producer task
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
