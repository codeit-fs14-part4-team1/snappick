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
# 등록 안 된 임시 원본(uploads/) 정리 — 성공한 원본은 API가 바로 지움
resource "aws_s3_bucket_lifecycle_configuration" "images" {
  bucket = aws_s3_bucket.images.id

  rule {
    id     = "expire-uploads"
    status = "Enabled"
    filter {
      prefix = "uploads/"
    }
    expiration {
      days = 1
    }
  }
}

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

# cloudfront 신분증
resource "aws_cloudfront_origin_access_control" "images" {
  name                              = "snappick-staging-images"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}
# 이미지 CDN (버킷은 비공개, OAC로만 읽음)
resource "aws_cloudfront_distribution" "images" {
  enabled = true
  origin {
    domain_name              = aws_s3_bucket.images.bucket_regional_domain_name
    origin_id                = "cdn_access"
    origin_access_control_id = aws_cloudfront_origin_access_control.images.id
  }
  default_cache_behavior {
    target_origin_id       = "cdn_access"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
  }
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
# CloudFront(우리 배포)만 공개 경로를 읽을 수 있게
data "aws_iam_policy_document" "images_cdn_read" {
  statement {
    effect = "Allow"

    actions = [
      "s3:GetObject",
    ]
    resources = [
      "${aws_s3_bucket.images.arn}/mock/*",
      "${aws_s3_bucket.images.arn}/photos/*",
      "${aws_s3_bucket.images.arn}/profiles/*",
    ]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.images.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "images_cdn_read" {
  bucket = aws_s3_bucket.images.id
  policy = data.aws_iam_policy_document.images_cdn_read.json
}

output "image_cdn_domain" {
  description = "CloudFront domain for images (IMAGE_BASE_URL)"
  value       = aws_cloudfront_distribution.images.domain_name
}