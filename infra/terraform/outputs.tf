output "api_base_url" {
  description = "Public API base URL; set as NEXT_PUBLIC_API_BASE_URL when building the frontend"
  value       = "https://${local.api_hostname}/api/v1"
}

output "api_cloudfront_distribution_domain_name" {
  description = "CloudFront hostname in front of the API Lambda"
  value       = aws_cloudfront_distribution.api.domain_name
}

output "api_lambda_function_name" {
  description = "Name of the API Lambda function"
  value       = aws_lambda_function.api.function_name
}

output "api_lambda_function_url_function_url" {
  description = "Raw Function URL of the API Lambda, for debugging without Cloudflare/CloudFront"
  value       = aws_lambda_function_url.api.function_url
}

output "main_ecr_repository_url" {
  description = "ECR repository URL to push backend images to"
  value       = aws_ecr_repository.main.repository_url
}

output "web_pages_project_name" {
  description = "Cloudflare Pages project name for `wrangler pages deploy`"
  value       = cloudflare_pages_project.web.name
}

output "worker_dlq_sqs_queue_url" {
  description = "URL of the queue holding deck generations that failed every retry"
  value       = aws_sqs_queue.worker_dlq.url
}

output "worker_lambda_function_name" {
  description = "Name of the deck-generation worker Lambda function"
  value       = aws_lambda_function.worker.function_name
}
