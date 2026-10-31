resource "aws_security_group" "api" {
  name        = "snappick-staging-api-sg"
  description = "Security group for the SnapPick API"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "snappick-staging-api-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "api_http" {
  security_group_id = aws_security_group.api.id

  description = "Temporary public HTTP access for initial deployment"
  cidr_ipv4   = "0.0.0.0/0"
  from_port   = 80
  to_port     = 80
  ip_protocol = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "api_outbound" {
  security_group_id = aws_security_group.api.id

  description = "Allow API server outbound access"
  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"
}

resource "aws_security_group" "db" {
  name        = "snappick-staging-db-sg"
  description = "Security group for the SnapPick PostgreSQL database"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "snappick-staging-db-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "db_postgres_from_api" {
  security_group_id = aws_security_group.db.id

  description                  = "Allow PostgreSQL only from the API security group"
  referenced_security_group_id = aws_security_group.api.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}
