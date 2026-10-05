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

  # State holds no secrets (they go through write-only attributes). The bucket is
  # created by hand (versioned, public access blocked) since Terraform can't
  # bootstrap its own backend.
  backend "s3" {
    bucket       = "magic-grimoire-tfstate-822115368904"
    key          = "magic-grimoire/prod.tfstate"
    region       = "eu-north-1"
    encrypt      = true
    use_lockfile = true
  }
}
