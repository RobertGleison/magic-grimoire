terraform {
  required_version = ">= 1.14"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }

  # State holds no secrets (they go through write-only attributes), but keep it
  # off laptops once more than one person deploys:
  #
  # backend "s3" {
  #   bucket       = "<your-state-bucket>"
  #   key          = "magic-grimoire/prod.tfstate"
  #   region       = "eu-west-1"
  #   encrypt      = true
  #   use_lockfile = true
  # }
}
