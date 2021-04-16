
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
