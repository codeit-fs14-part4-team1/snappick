data "aws_caller_identity" "current" {}

locals {
  image_bucket_name = "snappick-staging-photos"
}

resource "aws_s3_bucket" "images" {
  bucket = local.image_bucket_name
}

resource "aws_s3_bucket_public_access_block" "images" {
  bucket = aws_s3_bucket.images.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "images" {
  bucket = aws_s3_bucket.images.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "images" {
  bucket = aws_s3_bucket.images.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# 브라우저가 presigned URL로 직접 PUT하려면 필요하다 (② 업로드)
resource "aws_s3_bucket_cors_configuration" "images" {
  bucket = aws_s3_bucket.images.id

  cors_rule {
    allowed_methods = ["PUT"]
    allowed_headers = ["content-type"]
    allowed_origins = [
      "http://localhost:3000",
      "https://snappick-alpha.vercel.app",
    ]
    max_age_seconds = 3000
  }
}
