# The zone itself (registration + nameservers) is created by hand in the
# Cloudflare dashboard; Terraform manages what lives inside it.

resource "cloudflare_dns_record" "api_certificate_validation" {
  for_each = {
    for option in aws_acm_certificate.api.domain_validation_options : option.domain_name => option
  }

  zone_id = var.cloudflare_zone_id
  name    = trimsuffix(each.value.resource_record_name, ".")
  type    = each.value.resource_record_type
  content = trimsuffix(each.value.resource_record_value, ".")
  ttl     = 60
  proxied = false
}

# Proxied, so the WAF and rate limit apply before traffic reaches AWS.
resource "cloudflare_dns_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = local.api_hostname
  type    = "CNAME"
  content = aws_cloudfront_distribution.api.domain_name
  ttl     = 1
  proxied = true
}

# CloudFront presents a valid ACM certificate, so Cloudflare can verify it.
resource "cloudflare_zone_setting" "ssl" {
  zone_id    = var.cloudflare_zone_id
  setting_id = "ssl"
  value      = "strict"
}

# Free plan allows one rate-limit rule (10 s period, IP-based). Spend it on the
# endpoint that triggers paid LLM calls and works for signed-out users.
resource "cloudflare_ruleset" "rate_limit" {
  zone_id     = var.cloudflare_zone_id
  name        = "${local.name_prefix}-rate-limit"
  description = "Throttle deck generation per client IP"
  kind        = "zone"
  phase       = "http_ratelimit"

  rules = [{
    action      = "block"
    description = "Limit POST /api/v1/decks/generate"
    enabled     = true
    expression  = "(http.request.uri.path eq \"/api/v1/decks/generate\")"

    ratelimit = {
      characteristics     = ["cf.colo.id", "ip.src"]
      mitigation_timeout  = 10
      period              = 10
      requests_per_period = var.generate_rate_limit_requests
    }
  }]
}

# Static Next.js export, deployed by CI with `wrangler pages deploy out`.
resource "cloudflare_pages_project" "web" {
  account_id        = var.cloudflare_account_id
  name              = var.project_name
  production_branch = "main"
}

resource "cloudflare_pages_domain" "web" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.web.name
  name         = var.domain_name
}

resource "cloudflare_dns_record" "web" {
  zone_id = var.cloudflare_zone_id
  name    = var.domain_name
  type    = "CNAME"
  content = cloudflare_pages_project.web.subdomain
  ttl     = 1
  proxied = true
}
