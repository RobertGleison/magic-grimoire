# Secrets go in through write-only attributes, so Terraform state never holds
# them. Lambdas read everything under SSM_PARAMETER_PATH at cold start; the
# parameter name (after the path) is the settings field it populates.
# Rotate: change the value in your tfvars, bump var.secrets_version, apply.

resource "aws_ssm_parameter" "database_url" {
  name             = "${local.ssm_parameter_path}/DATABASE_URL"
  description      = "Supabase Postgres URL (transaction pooler)"
  type             = "SecureString"
  value_wo         = var.database_url
  value_wo_version = var.secrets_version
}

resource "aws_ssm_parameter" "llm_api_key" {
  name             = "${local.ssm_parameter_path}/LLM_API_KEY"
  description      = "API key for the OpenAI-compatible LLM provider"
  type             = "SecureString"
  value_wo         = var.llm_api_key
  value_wo_version = var.secrets_version
}

resource "aws_ssm_parameter" "supabase_jwt_secret" {
  name             = "${local.ssm_parameter_path}/SUPABASE_JWT_SECRET"
  description      = "Supabase JWT secret for verifying access tokens"
  type             = "SecureString"
  value_wo         = var.supabase_jwt_secret
  value_wo_version = var.secrets_version
}
