---
name: owasp-review
description: >
  Security review of staged git changes or recent commits against the OWASP Top 10 vulnerabilities.
  Use this skill whenever the user is about to commit code, asks for a security review, mentions
  OWASP, or wants to check for vulnerabilities before pushing. Triggers on: "commit", "security
  review", "owasp", "check vulnerabilities", "safe to commit", "/owasp-review". Also invoke this
  proactively if the user runs /commit or mentions committing code and the diff touches security-
  sensitive areas (auth, crypto, HTTP requests, DB queries, user input handling).
user-invocable: true
---

# OWASP Top 10 Security Review

Analyze staged git changes (or recent commits) for the OWASP Top 10 vulnerabilities (2021 edition).
Produce a clear, actionable security report before code reaches the repository.

---

## Step 1 — Gather the diff

Run the following commands to understand what's changing:

```bash
git diff --staged          # staged changes ready to commit
git diff --staged --name-only   # list of affected files
```

If nothing is staged, fall back to:
```bash
git diff HEAD~1            # changes in the most recent commit
```

If the user pointed you at specific files or a PR, read those instead.

Collect:
- The full diff text
- The list of affected file paths and their languages (Python, TypeScript, etc.)

---

## Step 2 — Analyze against OWASP Top 10

Work through each category below. For each one, look at the diff for the patterns listed.
You are looking for **new or changed code** that introduces a risk — not pre-existing issues
outside the diff (flag those separately as "pre-existing concern" if notable).

Read `references/owasp-patterns.md` for the full pattern checklist per category.

For each finding, record:
- **Category** (A01–A10 + name)
- **Severity** (Critical / High / Medium / Low / Info)
- **File + line** (from the diff context)
- **What the issue is** (one sentence)
- **Why it matters** (one sentence — the real-world risk)
- **How to fix it** (concrete, specific suggestion)

---

## Step 3 — Produce the security report

Output the report in this exact structure:

```
## OWASP Security Review
**Commit scope:** <git diff --staged --stat summary or file list>
**Review date:** <today>
**Verdict:** PASS ✓ | WARN ⚠️  | BLOCK ✗

---

### Critical findings  (block commit)
[list findings or "None"]

### High findings  (fix before merge)
[list findings or "None"]

### Medium findings  (address in follow-up)
[list findings or "None"]

### Low / Informational
[list findings or "None"]

---

### Verdict explanation
<one paragraph: overall risk assessment, what must be fixed now vs. later>
```

**Verdict rules:**
- **BLOCK ✗** — one or more Critical findings (e.g. hardcoded secret, raw SQL injection, unauthenticated admin route)
- **WARN ⚠️** — High or Medium findings but no Critical ones
- **PASS ✓** — only Low/Info findings or nothing found

**Finding format** (repeat for each):
```
#### [A0X] <Vulnerability Name> — <Severity>
**File:** `path/to/file.py:42`
**Issue:** <what the code does wrong>
**Risk:** <what an attacker could do>
**Fix:** <specific remediation>
```

---

## Step 4 — After the report

- If verdict is **BLOCK**: Tell the user clearly that the commit should not proceed until Critical findings are resolved. Offer to fix them now.
- If verdict is **WARN**: Recommend addressing High findings before merging to main. Offer to fix inline or open GitHub issues.
- If verdict is **PASS**: Confirm it's clear to commit, briefly note any Low/Info items for awareness.

Do not run `git commit` yourself — leave that decision to the user.

---

## Project context

This repo uses **Python 3.13 (FastAPI + SQLAlchemy async)** for the backend and
**TypeScript / Next.js 15** for the frontend. Sensitive areas to pay extra attention to:
- `apps/api-server/app/decks/` — LLM prompt construction (injection risk)
- `apps/api-server/app/core/` — auth middleware and DB config
- `apps/api-server/app/services/` — external API calls (SSRF), Redis (cache poisoning)
- `apps/web-app/app/` — React components (XSS), auth token handling
