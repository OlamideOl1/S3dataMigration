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
