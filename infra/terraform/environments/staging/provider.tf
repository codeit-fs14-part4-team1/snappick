provider "aws" {
  region = "ap-southeast-2"

  default_tags {
    tags = {
      Project     = "snappick"
      Environment = "staging"
      ManagedBy   = "terraform"
    }
  }
}
