# OWASP Top 10 (2021) — Pattern Checklist

For each category, check the diff for these patterns. Severity guides are defaults — adjust based on context (e.g. an unauthenticated endpoint is worse than an authenticated one).

---

## A01 — Broken Access Control

**Severity:** Critical to High

Patterns to flag:
- New routes/endpoints with no auth middleware or decorator (`@requires_auth`, JWT validation, `Depends(get_current_user)`)
- Authorization checks that only validate authentication, not authorization (e.g. any logged-in user can delete any record)
- Direct object references using user-supplied IDs without ownership check (e.g. `SELECT * FROM decks WHERE id = :id` with no `user_id` filter)
- `user_id` not included in WHERE clause for user-owned resources
- Admin/privileged routes reachable without role check
- CORS configured to allow all origins (`allow_origins=["*"]`) on sensitive endpoints
- Frontend hiding UI elements instead of enforcing server-side access

---

## A02 — Cryptographic Failures

**Severity:** Critical to High

Patterns to flag:
- Hardcoded secrets, API keys, passwords, tokens in code (regex: `(secret|password|api_key|token|key)\s*=\s*['"][^'"]{8,}`)
- Secrets in environment variable defaults that look real
- Weak hash algorithms: `MD5`, `SHA1`, `SHA-1` used for passwords or security tokens
- `hashlib.md5(`, `hashlib.sha1(` in non-integrity contexts
- Sensitive data (passwords, PII, tokens) stored in plaintext in DB columns or logs
- HTTP URLs hardcoded for API endpoints that should be HTTPS
- JWT `alg: none` or symmetric secret used as public key
- Cookies without `Secure`, `HttpOnly`, or `SameSite` flags

---

## A03 — Injection

**Severity:** Critical

Patterns to flag:

**SQL Injection:**
- String formatting/concatenation in SQL queries: `f"SELECT ... {user_input}"`, `"SELECT ... " + variable`
- Raw SQL with `.execute(f"..."` or `text(f"...")` using unsanitized input
- ORM `filter()` called with string literals instead of parameterized expressions

**Command Injection:**
- `os.system(`, `subprocess.run(`, `subprocess.Popen(` with user-controlled input not in a list
- Shell=True with string argument derived from user input

**XSS (Cross-Site Scripting):**
- `dangerouslySetInnerHTML` in React without sanitization
- `innerHTML =` with user data
- Template rendering of unsanitized user input in HTML context
- `res.send(userInput)` or similar in Express/Next API routes

**Prompt Injection (LLM-specific):**
- User-controlled text inserted directly into LLM system prompts without clear delimiters or sanitization
- `f"...{user_prompt}..."` in prompt construction without escaping user content

**NoSQL/Redis Injection:**
- Redis keys constructed from user input without sanitization
- MongoDB queries with user-controlled operators

---

## A04 — Insecure Design

**Severity:** Medium to High

Patterns to flag:
- No rate limiting on sensitive endpoints (login, password reset, API calls)
- Password reset / OTP logic that doesn't expire tokens
- Business logic that can be bypassed by changing a parameter (e.g. `price` or `role` sent from client)
- Bulk operations without pagination or limits (potential DoS)
- Missing input validation on fields that drive critical logic

---

## A05 — Security Misconfiguration

**Severity:** High to Medium

Patterns to flag:
- `DEBUG = True` or `debug=True` in production config or environment defaults
- Default or example credentials in config files committed to repo
- Overly permissive CORS: `allow_origins=["*"]` with `allow_credentials=True` (this is a protocol error too)
- Stack traces / detailed error messages exposed to end users in production responses
- Unnecessary HTTP methods enabled (e.g. `methods=["*"]`)
- `expose_headers` leaking internal headers
- `.env` files added to git (check `.gitignore` changes)
- Security headers missing in new middleware/responses (CSP, X-Frame-Options, HSTS)

---

## A06 — Vulnerable and Outdated Components

**Severity:** Medium (flag for awareness)

Patterns to flag:
- `pyproject.toml` or `package.json` changes that downgrade dependency versions
- New dependencies added without pinned versions
- Known-vulnerable package versions (check if version being added is end-of-life or has known CVEs for common packages)
- Direct use of deprecated crypto libraries or old TLS versions

---

## A07 — Identification and Authentication Failures

**Severity:** High to Critical

Patterns to flag:
- JWT validation skipped or `verify=False`
- JWT decoded without signature verification
- Session tokens that never expire (no `exp` claim)
- Passwords stored without hashing (or with reversible encryption)
- "Remember me" tokens that are predictable or not rotated
- Multi-factor authentication bypassed in certain code paths
- Password complexity not enforced at the backend (only frontend validation)
- Auth check inside a function that can be called before auth is established

---

## A08 — Software and Data Integrity Failures

**Severity:** High to Medium

Patterns to flag:
- Deserialization of user-supplied data with `pickle.loads(`, `yaml.load(` without `SafeLoader`, `eval(user_input)`
- Dynamic code execution: `exec(`, `eval(` with user-controlled input
- Dependencies fetched from CDN/external URLs without integrity hashes (`<script src="...">` without `integrity=`)
- Auto-update mechanisms that pull code without verification
- CI/CD pipeline changes that skip signing or introduce new external download steps

---

## A09 — Security Logging and Monitoring Failures

**Severity:** Medium to Low

Patterns to flag:
- Logging of sensitive fields: `logging.info(f"password={password}")`, `logger.debug(token)`, logging full request bodies that may contain credentials
- Removal of existing security logging (login failures, access denied events)
- Missing logging for privileged operations (user deletion, role changes, config updates)
- Errors swallowed silently with bare `except: pass` in security-relevant code

---

## A10 — Server-Side Request Forgery (SSRF)

**Severity:** Critical to High

Patterns to flag:
- HTTP client calls (`httpx.get(`, `requests.get(`, `fetch(`) where the URL is constructed from user input
- URL parameter passed to any HTTP library: `url = request.query_params["url"]`
- Cloud metadata endpoint accessible: user-controlled URL that could resolve to `169.254.169.254`
- Missing allowlist/denylist for outbound URLs
- Redirect URLs accepted from user without validation (open redirect → SSRF chain)
- Webhook URLs configured by users without domain validation
