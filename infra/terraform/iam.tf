data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# Shared by both functions: write to their own log group, read the secrets.
data "aws_iam_policy_document" "backend_base" {
  for_each = {
    api    = aws_cloudwatch_log_group.api.arn
    worker = aws_cloudwatch_log_group.worker.arn
  }

  statement {
    sid       = "WriteOwnLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${each.value}:*"]
  }

  statement {
    sid     = "ReadSecrets"
    actions = ["ssm:GetParametersByPath"]
    resources = [
      "arn:aws:ssm:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:parameter${local.ssm_parameter_path}",
    ]
  }

  statement {
    sid       = "DecryptSecrets"
    actions   = ["kms:Decrypt"]
    resources = [data.aws_kms_alias.ssm.target_key_arn]

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${data.aws_region.current.region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "api" {
  name               = "${local.name_prefix}-api"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy" "api_base" {
  name   = "base"
  role   = aws_iam_role.api.id
  policy = data.aws_iam_policy_document.backend_base["api"].json
}

data "aws_iam_policy_document" "api_dispatch" {
  statement {
    sid       = "DispatchDeckGeneration"
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.worker.arn]
  }
}

resource "aws_iam_role_policy" "api_dispatch" {
  name   = "dispatch"
  role   = aws_iam_role.api.id
  policy = data.aws_iam_policy_document.api_dispatch.json
}

resource "aws_iam_role" "worker" {
  name               = "${local.name_prefix}-worker"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy" "worker_base" {
  name   = "base"
  role   = aws_iam_role.worker.id
  policy = data.aws_iam_policy_document.backend_base["worker"].json
}

# Lambda delivers failed async events to the DLQ using the function's own role.
data "aws_iam_policy_document" "worker_dead_letter" {
  statement {
    sid       = "SendFailedGenerations"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.worker_dlq.arn]
  }
}

resource "aws_iam_role_policy" "worker_dead_letter" {
  name   = "dead-letter"
  role   = aws_iam_role.worker.id
  policy = data.aws_iam_policy_document.worker_dead_letter.json
}

# CI (.github/workflows/deploy-api.yml) pushes images and points both functions at
# them. GitHub OIDC needs iam:CreateOpenIDConnectProvider, which this account's SCP
# denies, so CI uses this user's access key. The key is created in the console, not
# here, so it never lands in state. Function ARNs are built from names so this can be
# applied (-target) before the functions exist.
resource "aws_iam_user" "deploy" {
  name = "${local.name_prefix}-deploy"
}

data "aws_iam_policy_document" "deploy" {
  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "PushImage"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = [aws_ecr_repository.main.arn]
  }

  statement {
    sid     = "UpdateFunctionCode"
    actions = ["lambda:GetFunction", "lambda:GetFunctionConfiguration", "lambda:UpdateFunctionCode"]
    resources = [
      for name in ["api", "worker"] :
      "arn:aws:lambda:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:function:${local.name_prefix}-${name}"
    ]
  }
}

resource "aws_iam_user_policy" "deploy" {
  name   = "deploy"
  user   = aws_iam_user.deploy.name
  policy = data.aws_iam_policy_document.deploy.json
}
