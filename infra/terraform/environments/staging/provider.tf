provider "aws" {
  region = "ap-northeast-2"

  default_tags {
    tags = {
      Project     = "snappick"
      Environment = "staging"
      ManagedBy   = "terraform"
    }
  }
}
