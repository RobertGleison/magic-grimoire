# Serverless backend for Magic Grimoire:
#
#   Cloudflare (DNS, WAF, rate limit, Pages frontend)
#     -> CloudFront (custom domain + TLS for the Function URL)
#       -> api Lambda (FastAPI)  --async invoke-->  worker Lambda (deck pipeline)
#                                                     -> SQS DLQ on final failure
#
# Postgres + Auth live in Supabase; the LLM is an OpenAI-compatible API.
# Resources are split by concern: ecr.tf, ssm.tf, iam.tf, lambda.tf, cdn.tf,
# cloudflare.tf, monitoring.tf.

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

# AWS-managed key that encrypts SecureString parameters at no cost.
data "aws_kms_alias" "ssm" {
  name = "alias/aws/ssm"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

# Forwards every viewer header (incl. Authorization) except Host, which must be
# the Function URL's own hostname or Lambda rejects the request.
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host_header" {
  name = "Managed-AllViewerExceptHostHeader"
}
