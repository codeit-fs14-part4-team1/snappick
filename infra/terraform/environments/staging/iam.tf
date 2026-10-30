data "aws_iam_policy_document" "api_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "api" {
  name               = "snappick-staging-api-role"
  assume_role_policy = data.aws_iam_policy_document.api_assume_role.json
}

data "aws_iam_policy_document" "api_s3" {
  statement {
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.images.arn]
  }

  statement {
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]

    resources = ["${aws_s3_bucket.images.arn}/*"]
  }
}

resource "aws_iam_policy" "api_s3" {
  name   = "snappick-staging-api-s3"
  policy = data.aws_iam_policy_document.api_s3.json
}

resource "aws_iam_role_policy_attachment" "api_s3" {
  role       = aws_iam_role.api.name
  policy_arn = aws_iam_policy.api_s3.arn
}

data "aws_iam_policy_document" "api_db_secret" {
  statement {
    effect  = "Allow"
    actions = ["secretsmanager:GetSecretValue"]

    resources = [
      aws_db_instance.postgres.master_user_secret[0].secret_arn,
      data.aws_secretsmanager_secret.jwt_access.arn,
      data.aws_secretsmanager_secret.db_app.arn,
    ]
  }
}

resource "aws_iam_policy" "api_db_secret" {
  name   = "snappick-staging-api-db-secret"
  policy = data.aws_iam_policy_document.api_db_secret.json
}

resource "aws_iam_role_policy_attachment" "api_db_secret" {
  role       = aws_iam_role.api.name
  policy_arn = aws_iam_policy.api_db_secret.arn
}

resource "aws_iam_instance_profile" "api" {
  name = "snappick-staging-api-profile"
  role = aws_iam_role.api.name
}

resource "aws_iam_role_policy_attachment" "api_beanstalk_web" {
  role       = aws_iam_role.api.name
  policy_arn = "arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier"
}

resource "aws_iam_role_policy_attachment" "api_ssm" {
  role       = aws_iam_role.api.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "beanstalk_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["elasticbeanstalk.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values   = ["elasticbeanstalk"]
    }
  }
}

resource "aws_iam_role" "beanstalk_service" {
  name               = "snappick-staging-beanstalk-service-role"
  assume_role_policy = data.aws_iam_policy_document.beanstalk_assume_role.json
}

resource "aws_iam_role_policy_attachment" "beanstalk_enhanced_health" {
  role       = aws_iam_role.beanstalk_service.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSElasticBeanstalkEnhancedHealth"
}

resource "aws_iam_role_policy_attachment" "beanstalk_managed_updates" {
  role       = aws_iam_role.beanstalk_service.name
  policy_arn = "arn:aws:iam::aws:policy/AWSElasticBeanstalkManagedUpdatesCustomerRolePolicy"
}