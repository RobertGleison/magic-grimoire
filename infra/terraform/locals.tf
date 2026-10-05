locals {
  api_hostname       = "${var.api_subdomain}.${var.domain_name}"
  name_prefix        = "${var.project_name}-${var.environment}"
  ssm_parameter_path = "/${var.project_name}/${var.environment}"

  # Function URLs look like https://<id>.lambda-url.<region>.on.aws/ — CloudFront wants the bare host.
  api_function_url_host = trimsuffix(trimprefix(aws_lambda_function_url.api.function_url, "https://"), "/")

  common_tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
    Project     = var.project_name
  }

  # Non-secret settings read by app/core/config.py. Secrets are loaded at cold
  # start from SSM_PARAMETER_PATH (see ssm.tf), never placed in env vars.
  backend_environment = {
    ALLOWED_ORIGINS      = "https://${var.domain_name}"
    DB_USE_NULL_POOL     = "true"
    ENVIRONMENT          = "production"
    JWT_ALGORITHM        = var.jwt_algorithm
    LLM_BASE_URL         = var.llm_base_url
    LLM_DISABLE_THINKING = "true"
    LLM_MODEL            = var.llm_model
    LLM_PROVIDER         = "openai_compat"
    SSM_PARAMETER_PATH   = local.ssm_parameter_path
  }
}
