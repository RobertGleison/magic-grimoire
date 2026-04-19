---
tags: [adr]
status: Accepted
created: 2026-04-19
---

# ADR-0001: Authentication Flow and Personal Deck Library

## Status

`Accepted`

## Context

Magic Grimoire needs a way for users to log in and access a personal space where all decks they've generated are stored. The system must also handle unauthenticated guests fairly — allowing them to experience value before committing to an account — while preventing unlimited free usage.

Supabase Auth (Google + GitHub OAuth) was already chosen as the identity provider, and `AuthModal.tsx`, `UserContext.tsx`, and the `/library/` route already exist as scaffolding. The open decisions were: where login is triggered, how the library is presented, and how to enforce the one-free-deck limit for guests.

## Decision Drivers

- Portfolio project — simplicity and UX quality matter more than airtight enforcement
- Redis is already in the stack (Celery broker + Scryfall cache) — leverage it
- Guest should see value (a generated deck) before being asked to sign up
- localStorage alone is bypassable — enforcement must live on the backend

## Considered Options

| Option | Pros | Cons |
|---|---|---|
| **localStorage gate + blocking modal** | Simple, no backend changes | Bypassable, blocks before user sees value |
| **Optimistic generate → save prompt, IP rate-limited** | Great UX hook, Redis already available, can't be bypassed from browser | VPN bypasses, shared-IP edge cases |
| **Full anonymous session (backend)** | Fully enforced | Overkill for portfolio, new DB/session logic required |

## Decision

**Chosen option: Optimistic generate → post-generation save prompt, enforced via Redis IP rate limiting**

Guests may generate one deck freely. After generation completes, a "Sign in to save this deck" overlay is shown. On the backend, `POST /decks/generate` checks `ratelimit:ip:{ip}` in Redis before queuing the Celery task — first generation sets the key, second returns `429`. Authenticated users (JWT present) bypass the check entirely. The `/library/` route is auth-gated and presents all three views (list, grid, expandable detail) with a toggle.

Login is triggered from a button in `SpineNav` which opens the existing `AuthModal` overlay — no dedicated `/login` route needed.

## Consequences

### Positive
- User sees a real generated deck before being asked for anything — strongest signup hook
- No new DB models or session infrastructure required
- Rate limiting reuses existing Redis connection and cache patterns

### Negative
- IP-based limit can be bypassed with a VPN — acceptable trade-off for portfolio scope
- Shared networks (offices, universities) may hit the limit across users

### Risks
- **Redis TTL for rate limit keys is undecided.** `ratelimit:ip:{ip}` keys must be given an explicit TTL at implementation time. No TTL means keys accumulate forever; too short a TTL (e.g. 1h) allows repeated free generation. Recommended: 30-day TTL as a reasonable middle ground for a portfolio project. This choice must be captured in a code comment or follow-up ADR when the rate limiter is implemented.

## Related

- [[adr/index]]
- [[Home]]
