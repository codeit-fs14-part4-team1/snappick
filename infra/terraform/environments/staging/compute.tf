resource "aws_elastic_beanstalk_application" "api" {
  name        = "snappick-staging-api"
  description = "SnapPick staging Express API"
}

resource "aws_elastic_beanstalk_environment" "api" {
  depends_on = [
    aws_iam_role_policy_attachment.api_db_secret,
  ]

  name                = "snappick-staging-api-env"
  application         = aws_elastic_beanstalk_application.api.name
  solution_stack_name = "64bit Amazon Linux 2023 v6.11.12 running Node.js 24"
  cname_prefix        = "snappick-staging-api"

  tier = "WebServer"

  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "EnvironmentType"
    value     = "SingleInstance"
  }

  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "ServiceRole"
    value     = aws_iam_role.beanstalk_service.arn
  }

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "IamInstanceProfile"
    value     = aws_iam_instance_profile.api.name
  }

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "InstanceType"
    value     = "t3.micro"
  }

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "SecurityGroups"
    value     = aws_security_group.api.id
  }

  setting {
    namespace = "aws:ec2:vpc"
    name      = "VPCId"
    value     = aws_vpc.main.id
  }

  setting {
    namespace = "aws:ec2:vpc"
    name      = "Subnets"
    value     = aws_subnet.public_api_a.id
  }

  setting {
    namespace = "aws:ec2:vpc"
    name      = "AssociatePublicIpAddress"
    value     = "true"
  }

  setting {
    namespace = "aws:elasticbeanstalk:healthreporting:system"
    name      = "SystemType"
    value     = "enhanced"
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "DB_HOST"
    value     = aws_db_instance.postgres.address
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "DB_PORT"
    value     = tostring(aws_db_instance.postgres.port)
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "DB_NAME"
    value     = aws_db_instance.postgres.db_name
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environmentsecrets"
    name      = "DB_CREDENTIALS"
    value     = aws_db_instance.postgres.master_user_secret[0].secret_arn
  }


  setting {
    namespace = "aws:elasticbeanstalk:command"
    name      = "Timeout"
    value     = "1200"
  }
}



output "api_environment_cname" {
  description = "Elastic Beanstalk API environment hostname"
  value       = aws_elastic_beanstalk_environment.api.cname
}