resource "aws_iam_access_key" "s3Mig" {
  user    = aws_iam_user.s3Mig.name
}

resource "aws_iam_user" "s3Mig" {
  name = "s3Mig"
}

resource "aws_iam_user_policy" "s3Mig" {
  name = "s3Mig_Policy"
  user = aws_iam_user.s3Mig.name
  policy =  <<EOF
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

resource "local_file" "s3MigAccessKeyID" {
    content = aws_iam_access_key.s3Mig.id
    filename = "${path.module}/s3MigAccessKeyID.txt"
}

resource "local_file" "s3MigSecretAccessKey" {
    content = aws_iam_access_key.s3Mig.secret
    filename = "${path.module}/s3MigSecretAccessKey.txt"
}

output "secret" {
  value = aws_iam_access_key.s3Mig.secret
}

output "secretId" {
  value = aws_iam_access_key.s3Mig.id
}
