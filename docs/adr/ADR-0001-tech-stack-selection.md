---
tags: [adr]
status: Accepted
created: 2026-03-28
---

# ADR-0001: Tech Stack Selection

## Status

`Accepted`

## Context

Magic Grimoire is a personal/portfolio project where users describe a Magic: The Gathering deck in natural language, and the system generates a balanced 60-card deck using real MTG cards via an AI model (Anthropic Claude) and the Scryfall API. Users authenticate via OAuth to save and revisit their generated decks. Deck generation is a multi-step pipeline (intent parsing → card search → deck composition → card enrichment) that runs asynchronously via background workers. This ADR selects the languages, frameworks, database, queue/cache infrastructure, and auth provider for the entire project.

## Decision Drivers

- **Python AI ecosystem:** Future path to RAG and specialized models requires Python (LangChain, ChromaDB, HuggingFace). Choosing Python now avoids a rewrite later.
- **Minimal operational complexity:** A personal project should minimize the number of services to run and maintain.
- **Portfolio signal:** The stack should demonstrate modern, recognized tools that are immediately legible to reviewers.
- **Fast development:** Auth and infrastructure should not consume weeks — the interesting work is the deck generation pipeline.

## Considered Options

### Backend Framework

| Option | Pros | Cons |
|---|---|---|
| **FastAPI (Python)** | Async-native, auto OpenAPI docs, Pydantic validation, first-class Anthropic SDK support | Two languages when paired with a JS frontend |
| **Spring Boot (Java)** | Strong typing, enterprise-grade ecosystem | Verbose, slower iteration, Claude SDK is Python/TS-first, heavier local dev |

### Frontend Framework

| Option | Pros | Cons |
|---|---|---|
| **Next.js 15 (React)** | SSR for shareable deck pages, built-in image optimization, largest React ecosystem | More complex mental model (server vs client components), Vercel-centric |
| **Vite + React (SPA)** | Simplest setup, fastest dev server | No SSR — deck pages not indexable/shareable with previews, manual routing |
| **Remix** | Excellent data loading, closer to web standards | Smaller community, less portfolio recognition |

### Message Broker / Cache

| Option | Pros | Cons |
|---|---|---|
| **Redis** | Single service for 3 roles (Celery broker, Scryfall cache, SSE pub/sub), near-zero latency, free | Messages lost if Redis crashes mid-task, no built-in dead letter queues |
| **RabbitMQ** | Purpose-built broker, durable queues, delivery guarantees | Still need Redis for caching + pub/sub — two services instead of one |
| **Apache Kafka** | Massive throughput, event replay | Enormous operational overhead, Celery doesn't natively support it, absurd for personal scale |
| **Amazon SQS** | Fully managed, no infra to run | AWS lock-in, HTTP polling latency, still need Redis for cache + pub/sub, costs money |

### Auth Provider

| Option | Pros | Cons |
|---|---|---|
| **Supabase Auth** | 50k MAU free tier, Google + GitHub OAuth in minutes, issues standard JWTs (backend validates with PyJWT — no SDK needed), shallow coupling | Vendor dependency on Supabase |
| **Firebase Auth** | Same ease of setup, massive community | Google ecosystem lock-in, heavier Python integration (`firebase-admin` SDK), pulls toward Firebase ecosystem |
| **Auth0** | Most feature-rich (MFA, RBAC, branding) | Free tier limited to 7.5k MAU + 2 social providers, complex setup, overkill for simple OAuth |
| **NextAuth.js (Auth.js)** | No external service, full control | You manage session security, JWT signing, token refresh — more code for the same result |
| **Custom JWT** | Total control, zero dependencies | Weeks of work, auth bugs = security vulnerabilities |

## Decision

### Chosen stack:

| Layer | Choice |
|---|---|
| **Backend** | FastAPI (Python 3.13) + Celery workers |
| **Frontend** | Next.js 15 + TypeScript + Tailwind CSS |
| **Database** | PostgreSQL |
| **Broker / Cache / Pub/Sub** | Redis |
| **Auth** | Supabase Auth (Google + GitHub OAuth) |
| **AI** | Anthropic Claude API |

**FastAPI** was chosen over Spring Boot because Python's async model is a natural fit for the I/O-heavy deck generation pipeline (concurrent Scryfall + Claude API calls), the Anthropic Python SDK is first-class, and the Python AI/ML ecosystem (LangChain, ChromaDB) provides a clear path to RAG and specialized models in the future — without a language rewrite.

**Next.js** was chosen over Vite/SPA because deck pages need to be shareable with proper meta tags and content on first load (SSR), and it provides the strongest portfolio signal among React frameworks.

**Redis** was chosen over RabbitMQ/Kafka/SQS because it uniquely serves three roles in a single container: Celery broker, Scryfall response cache (24h TTL), and pub/sub channel for SSE progress events. Any other broker would still require Redis for caching and pub/sub, adding operational complexity with no benefit at this scale.

**Supabase Auth** was chosen over Firebase/Auth0/NextAuth because it issues standard JWTs that FastAPI validates with just `PyJWT` + a public key — no Supabase SDK in the backend. The coupling is shallow: if Supabase is dropped, only the frontend auth provider changes. The 50k MAU free tier removes any scale concern for a personal project.

## Consequences

### Positive
- Single-language backend (Python) with a clear path to RAG and specialized AI models
- Redis consolidates three infrastructure roles into one service
- Supabase Auth eliminates weeks of auth implementation — focus stays on the deck generation pipeline
- SSR deck pages are shareable and SEO-friendly
- Auto-generated OpenAPI docs from FastAPI serve as living API documentation

### Negative
- Two languages to maintain (Python + TypeScript)
- Redis lacks message durability — a crash during processing loses queued tasks (acceptable at personal scale: user re-submits)
- External dependency on Supabase for auth (mitigated by shallow coupling via standard JWTs)

### Risks
- **Celery complexity:** Celery configuration (broker, result backend, task serialization, retries) has a learning curve and known rough edges. Mitigation: keep worker code simple, use Redis as both broker and result backend.
- **Next.js churn:** Next.js App Router is still evolving (server actions, caching semantics). Mitigation: stick to stable patterns (client components for interactive UI, server components for static content).
- **Supabase availability:** If Supabase has an outage, new logins fail (existing JWTs continue to work until expiry). Mitigation: acceptable for a personal project.

## Related

- [[adr/index]]
- [[Home]]
