# Log groups are created up front so retention applies from the first invocation
# (Lambda would otherwise create them with infinite retention). Encrypted with
# CloudWatch's default key; a customer-managed KMS key would add ~$1/month.
resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${local.name_prefix}-api"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/aws/lambda/${local.name_prefix}-worker"
  retention_in_days = var.log_retention_days
}

# Runs the deck pipeline (parse intent -> search -> compose -> enrich) for one
# task, writing progress to the tasks row that the frontend polls.
resource "aws_lambda_function" "worker" {
  function_name                  = "${local.name_prefix}-worker"
  role                           = aws_iam_role.worker.arn
  package_type                   = "Image"
  image_uri                      = "${aws_ecr_repository.main.repository_url}:${var.image_tag}"
  architectures                  = ["arm64"]
  memory_size                    = var.worker_memory_size
  timeout                        = var.worker_timeout
  reserved_concurrent_executions = var.worker_reserved_concurrency

  environment {
    variables = local.backend_environment
  }

  image_config {
    command = ["app.lambda_handlers.worker_handler"]
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.worker.name
  }

  depends_on = [aws_iam_role_policy.worker_base]

  # CI owns the deployed image (deploy-api.yml); var.image_tag only seeds the first create.
  lifecycle {
    ignore_changes = [image_uri]
  }
}

# Async invoke is the job queue: Lambda retries failures, then parks the event
# in the DLQ. The pipeline must be idempotent per task_id for retries to be safe.
resource "aws_lambda_function_event_invoke_config" "worker" {
  function_name                = aws_lambda_function.worker.function_name
  maximum_event_age_in_seconds = 3600
  maximum_retry_attempts       = var.worker_max_retry_attempts

  destination_config {
    on_failure {
      destination = aws_sqs_queue.worker_dlq.arn
    }
  }

  depends_on = [aws_iam_role_policy.worker_dead_letter]
}

resource "aws_sqs_queue" "worker_dlq" {
  name                      = "${local.name_prefix}-worker-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
}

# FastAPI behind an ASGI adapter (Mangum); serves every /api/v1 route.
resource "aws_lambda_function" "api" {
  function_name = "${local.name_prefix}-api"
  role          = aws_iam_role.api.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.main.repository_url}:${var.image_tag}"
  architectures = ["arm64"]
  memory_size   = var.api_memory_size
  timeout       = var.api_timeout

  environment {
    variables = merge(local.backend_environment, {
      TASK_DISPATCHER      = "lambda"
      WORKER_FUNCTION_NAME = aws_lambda_function.worker.function_name
    })
  }

  image_config {
    command = ["app.lambda_handlers.api_handler"]
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.api.name
  }

  depends_on = [aws_iam_role_policy.api_base]

  # CI owns the deployed image (deploy-api.yml); var.image_tag only seeds the first create.
  lifecycle {
    ignore_changes = [image_uri]
  }
}

# CORS stays in FastAPI's middleware; configuring it here too would duplicate headers.
resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE"
}

# Public Function URLs need both permissions: InvokeFunctionUrl, and
# InvokeFunction restricted to calls arriving through the URL.
resource "aws_lambda_permission" "api_function_url" {
  statement_id           = "AllowPublicFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.api.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "api_invoke_via_url" {
  statement_id             = "AllowInvokeViaFunctionUrl"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.api.function_name
  principal                = "*"
  invoked_via_function_url = true
}
