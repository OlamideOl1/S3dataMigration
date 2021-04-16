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
