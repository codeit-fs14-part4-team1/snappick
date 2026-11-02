resource "aws_db_subnet_group" "main" {
  name = "snappick-staging-db-subnet-group"

  subnet_ids = [
    aws_subnet.private_db_a.id,
    aws_subnet.private_db_b.id,
  ]

  tags = {
    Name = "snappick-staging-db-subnet-group"
  }
}

resource "aws_db_instance" "postgres" {
  identifier = "snappick-staging-postgres"

  engine         = "postgres"
  instance_class = "db.t4g.micro"

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = "snappick"
  username = "snappick_admin"
  port     = 5432

  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period = 0
  deletion_protection     = false
  skip_final_snapshot     = true

  auto_minor_version_upgrade = true
  apply_immediately          = true

  tags = {
    Name = "snappick-staging-postgres"
  }
}

output "database_endpoint" {
  description = "Private PostgreSQL endpoint used by the API"
  value       = aws_db_instance.postgres.address
}

output "database_port" {
  description = "PostgreSQL port"
  value       = aws_db_instance.postgres.port
}

output "database_master_secret_arn" {
  description = "Secrets Manager ARN containing the generated DB credentials"
  value       = aws_db_instance.postgres.master_user_secret[0].secret_arn
  sensitive   = true
}