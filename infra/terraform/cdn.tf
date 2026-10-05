# Lambda Function URLs don't support custom domains, and rewriting the Host
# header in Cloudflare is Enterprise-only. CloudFront (always-free: 1 TB and
# 10M requests/month) terminates api.<domain> and forwards to the Function URL.

resource "aws_acm_certificate" "api" {
  provider = aws.us_east_1

  domain_name       = local.api_hostname
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate_validation" "api" {
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = [for record in cloudflare_dns_record.api_certificate_validation : record.name]
}

resource "aws_cloudfront_distribution" "api" {
  enabled         = true
  comment         = "${local.name_prefix} API"
  aliases         = [local.api_hostname]
  http_version    = "http2and3"
  is_ipv6_enabled = true
  price_class     = "PriceClass_100"

  origin {
    domain_name = local.api_function_url_host
    origin_id   = "api-lambda"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_read_timeout    = var.api_timeout
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id         = "api-lambda"
    allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host_header.id
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.api.certificate_arn
    minimum_protocol_version = "TLSv1.2_2021"
    ssl_support_method       = "sni-only"
  }
}
