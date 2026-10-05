variable "alert_email" {
  description = "Email address that receives budget and failed-generation alerts"
  type        = string
}

variable "api_memory_size" {
  description = "Memory (MB) for the API Lambda; CPU scales with it"
  type        = number
  default     = 512
}

variable "api_subdomain" {
  description = "Subdomain of domain_name that serves the backend API"
  type        = string
  default     = "api"
}

variable "api_timeout" {
  description = "Timeout (seconds) for the API Lambda; CloudFront's origin read timeout caps this at 60"
  type        = number
  default     = 60

  validation {
    condition     = var.api_timeout >= 1 && var.api_timeout <= 60
    error_message = "API timeout must be between 1 and 60 seconds (CloudFront origin read timeout limit)."
  }
}

variable "aws_region" {
  description = "AWS region for the Lambdas. The account is locked to eu-north-1 (its home region); Supabase stays in eu-west-1, adding ~30-40ms per query"
  type        = string
  default     = "eu-north-1"
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID that owns the Pages project"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID of domain_name"
  type        = string
}

variable "database_url" {
  description = "SQLAlchemy URL for the Supabase transaction pooler (postgresql+asyncpg://...:6543/postgres)"
  type        = string
  sensitive   = true
  ephemeral   = true
}

variable "domain_name" {
  description = "Apex domain serving the frontend, e.g. grimoire.example"
  type        = string
}

variable "environment" {
  description = "Target deployment environment"
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["staging", "prod"], var.environment)
    error_message = "Environment must be staging or prod."
  }
}

variable "generate_rate_limit_requests" {
  description = "Deck generations allowed per client IP per 10 seconds before Cloudflare blocks for 10 seconds"
  type        = number
  default     = 2
}

variable "image_tag" {
  description = "ECR image tag both Lambdas are created with; CI deploys later images"
  type        = string
}

variable "jwt_algorithm" {
  description = "Algorithm Supabase signs access tokens with"
  type        = string
  default     = "HS256"
}

variable "llm_api_key" {
  description = "API key for the OpenAI-compatible LLM provider"
  type        = string
  sensitive   = true
  ephemeral   = true
}

variable "llm_base_url" {
  description = "Base URL of the OpenAI-compatible LLM provider"
  type        = string
  default     = "https://api.deepseek.com"
}

variable "llm_model" {
  description = "Model name sent to the LLM provider"
  type        = string
  default     = "deepseek-flash"
}

variable "log_retention_days" {
  description = "CloudWatch log retention for both Lambdas"
  type        = number
  default     = 7
}

variable "monthly_budget_usd" {
  description = "AWS monthly cost budget; alerts at 80% forecast and 100% actual"
  type        = number
  default     = 5
}

variable "project_name" {
  description = "Prefix for resource names"
  type        = string
  default     = "magic-grimoire"
}

variable "secrets_version" {
  description = "Bump to push new values of the write-only secrets to SSM"
  type        = number
  default     = 1
}

variable "supabase_jwt_secret" {
  description = "Supabase JWT secret used to verify access tokens"
  type        = string
  sensitive   = true
  ephemeral   = true
}

variable "worker_max_retry_attempts" {
  description = "Times Lambda retries a failed async generation before sending it to the DLQ"
  type        = number
  default     = 2

  validation {
    condition     = var.worker_max_retry_attempts >= 0 && var.worker_max_retry_attempts <= 2
    error_message = "Lambda allows 0 to 2 async retry attempts."
  }
}

variable "worker_memory_size" {
  description = "Memory (MB) for the deck-generation worker Lambda"
  type        = number
  default     = 512
}

variable "worker_reserved_concurrency" {
  description = "Max concurrent deck generations (caps LLM spend); -1 leaves it unreserved"
  type        = number
  default     = -1
}

variable "worker_timeout" {
  description = "Timeout (seconds) for one deck generation; must exceed the LLM worst case (4 x 60s) plus Scryfall, and stay under TASK_STALE_AFTER_SECONDS (600)"
  type        = number
  default     = 360
}
