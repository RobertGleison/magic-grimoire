# Magic Grimoire - Technical Documentation

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Flowcharts](#flowcharts)
  - [Deck Generation Flow](#deck-generation-flow)
  - [Authentication Flow](#authentication-flow)
  - [SSE Real-Time Updates Flow](#sse-real-time-updates-flow)
- [API Routes](#api-routes)
  - [Health](#health)
  - [Authentication](#authentication)
  - [Decks](#decks)
  - [Tasks](#tasks)
- [Database Schema](#database-schema)
- [External Services](#external-services)
  - [Scryfall API](#scryfall-api)
  - [Claude API](#claude-api)
  - [Supabase Auth](#supabase-auth)
- [Infrastructure](#infrastructure)
  - [Docker Compose](#docker-compose)
  - [Kubernetes (Kind)](#kubernetes-kind)
- [Project Structure](#project-structure)
- [Frontend Pages](#frontend-pages)
- [Environment Variables](#environment-variables)

---

## Overview

Magic Grimoire is an AI-powered Magic: The Gathering deck generator. Users describe their dream deck in natural language (e.g., *"Create a white and black angel deck with lifelink"*), and the system generates a balanced, playable deck using real MTG cards.

The project is designed as a distributed system for learning purposes, using a request-queue-worker pattern orchestrated with Kubernetes (Kind).

---

## Tech Stack

| Layer             | Technology               | Purpose                                        |
|-------------------|--------------------------|------------------------------------------------|
| **Frontend**      | Next.js 15, TypeScript   | Server-side rendered React app                 |
| **Styling**       | Tailwind CSS 4           | Utility-first CSS with dark "grimoire" theme   |
| **Auth**          | Supabase Auth            | OAuth providers (Google, GitHub), JWT issuance  |
| **Backend**       | FastAPI (Python 3.13)    | Async REST API with JWT middleware             |
| **Task Queue**    | Celery 5                 | Distributed task processing                    |
| **Message Broker**| Redis 7                  | Celery broker, cache layer, SSE pub/sub        |
| **Database**      | PostgreSQL 16            | Persistent storage for users, decks, tasks     |
| **ORM**           | SQLAlchemy 2 (async)     | Database models and queries                    |
| **Migrations**    | Alembic                  | Schema version control                         |
| **AI**            | Claude API (Sonnet)      | Natural language parsing + deck composition    |
| **Card Data**     | Scryfall API             | MTG card search, images, and metadata          |
| **Monitoring**    | Flower                   | Celery task monitoring dashboard               |
| **Containers**    | Docker, Docker Compose   | Local development environment                  |
| **Orchestration** | Kind (Kubernetes)        | Production-like k8s cluster on local machine   |
| **HTTP Client**   | httpx                    | Async HTTP requests to external APIs           |

---

## System Architecture

```
                         ┌──────────────────────────────────────────────────┐
                         │                Kind Cluster                      │
                         │                                                  │
  ┌──────────┐    ┌──────┴──────┐    ┌───────────┐    ┌──────────────────┐ │
  │          │    │   NGINX     │    │  Next.js   │    │    Flower        │ │
  │ Browser  ├───►│  Ingress    ├───►│  Frontend  │    │  (monitoring)    │ │
  │          │    │             │    │  :3000     │    │  :5555           │ │
  └──────────┘    │  :80/:443  │    └───────────┘    └──────────────────┘ │
                  │             │                                          │
                  │             │    ┌───────────┐    ┌──────────────────┐ │
                  │             ├───►│  FastAPI   │    │  Celery Worker   │ │
                  │             │    │  Backend   ├───►│  (x2 replicas)   │ │
                  │             │    │  :8000     │    │                  │ │
                  └──────┬──────┘    └─────┬─────┘    └────────┬─────────┘ │
                         │                 │                    │           │
                         │          ┌──────┴────────────────────┘           │
                         │          │                                       │
                         │    ┌─────┴─────┐         ┌──────────────┐       │
                         │    │   Redis   │         │  PostgreSQL  │       │
                         │    │   :6379   │         │  :5432       │       │
                         │    └───────────┘         └──────────────┘       │
                         │                                                  │
                         └──────────────────────────────────────────────────┘
                                          │
                         ┌────────────────┼────────────────┐
                         │                │                │
                    ┌────┴─────┐   ┌──────┴─────┐   ┌─────┴──────┐
                    │ Supabase │   │  Scryfall  │   │  Claude    │
                    │ Auth     │   │  API       │   │  API       │
                    └──────────┘   └────────────┘   └────────────┘
                     (External)     (External)       (External)
```

### Service Roles

| Service        | Replicas | Role                                                            |
|----------------|----------|-----------------------------------------------------------------|
| **Frontend**   | 2        | Serves the Next.js app, handles OAuth callbacks                 |
| **Backend**    | 2        | REST API, JWT validation, task dispatch, SSE streaming          |
| **Worker**     | 2+       | Celery consumers that run deck generation (horizontally scalable)|
| **Redis**      | 1        | Message broker (Celery), cache (Scryfall), pub/sub (SSE)        |
| **PostgreSQL** | 1        | Persistent data (users, decks, tasks, chat messages)            |
| **Flower**     | 1        | Web UI for monitoring Celery tasks                              |
| **Ingress**    | 1        | NGINX routing: `/` → frontend, `/api/` → backend, `/flower/` → flower |

---

## Flowcharts

### Deck Generation Flow

This is the core flow — from user prompt to completed deck.

```
User types: "Create a white and black angel deck with lifelink"
│
▼
┌─────────────────────────────────────────────────────────────┐
│ 1. FRONTEND (Next.js)                                       │
│    POST /api/v1/decks/generate { prompt, format }           │
│    Opens SSE connection to /api/v1/tasks/{id}/stream        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. BACKEND (FastAPI)                                        │
│    - Validates JWT token                                    │
│    - Creates Deck record (status: "pending")                │
│    - Creates Task record (status: "queued")                 │
│    - Dispatches Celery task: generate_deck_task.delay()     │
│    - Returns { task_id, deck_id, status: "queued" }         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. REDIS (Message Broker)                                   │
│    Task message queued in "deck_generation" queue            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. CELERY WORKER                                            │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Step 1: Parse Intent (Claude API call #1)              │ │
│  │  → SSE event: "parsing_intent"                         │ │
│  │  Input:  "white and black angel deck with lifelink"    │ │
│  │  Output: {                                             │ │
│  │    colors: ["W", "B"],                                 │ │
│  │    creature_types: ["Angel"],                          │ │
│  │    keywords: ["lifelink"],                             │ │
│  │    themes: ["lifegain", "lifelink"],                   │ │
│  │    format: "standard",                                 │ │
│  │    strategy: "midrange"                                │ │
│  │  }                                                     │ │
│  └─────────────────────────┬──────────────────────────────┘ │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Step 2: Search Scryfall (multiple queries)             │ │
│  │  → SSE event: "searching_cards"                        │ │
│  │  Queries:                                              │ │
│  │    • "c:wb t:Angel kw:lifelink"                        │ │
│  │    • "c:wb t:creature kw:lifelink"                     │ │
│  │    • "c:wb o:lifegain"                                 │ │
│  │    • "c:wb (t:instant or t:sorcery)"                   │ │
│  │    • "c:wb (t:enchantment or t:artifact)"              │ │
│  │    • "t:land ci:wb"                                    │ │
│  │  Output: ~100-200 candidate cards (deduplicated)       │ │
│  └─────────────────────────┬──────────────────────────────┘ │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Step 3: Compose Deck (Claude API call #2)              │ │
│  │  → SSE event: "composing_deck"                         │ │
│  │  Input:  Candidate cards + intent + deck rules         │ │
│  │  Output: {                                             │ │
│  │    title: "Orzhov Angel Lifelink",                     │ │
│  │    cards: [                                            │ │
│  │      { name: "Angel of Vitality", qty: 4,             │ │
│  │        section: "creature" },                          │ │
│  │      { name: "Godless Shrine", qty: 4,                │ │
│  │        section: "land" },                              │ │
│  │      ...                                               │ │
│  │    ]                                                   │ │
│  │  }  (60 cards for Standard)                            │ │
│  └─────────────────────────┬──────────────────────────────┘ │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Step 4: Enrich Cards (Scryfall batch lookup)           │ │
│  │  → SSE event: "enriching"                              │ │
│  │  For each card: fetch image_uri, mana_cost, type_line  │ │
│  │  Uses /cards/named?exact= with Redis cache (24hr TTL)  │ │
│  └─────────────────────────┬──────────────────────────────┘ │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Step 5: Save to Database                               │ │
│  │  → SSE event: "completed"                              │ │
│  │  Update Deck: cards (JSONB), card_count, title, colors │ │
│  │  Update Task: status = "completed"                     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. FRONTEND receives SSE "completed" event                  │
│    Fetches GET /api/v1/decks/{id}                           │
│    Renders deck with card images, grouped by type           │
└─────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Browser  │     │ Frontend │     │ Supabase │     │ Backend  │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │  Click "Login  │                │                │
     │  with Google"  │                │                │
     │───────────────►│                │                │
     │                │                │                │
     │                │  signInWithOAuth({              │
     │                │    provider: "google"           │
     │                │  })            │                │
     │                │───────────────►│                │
     │                │                │                │
     │  ◄─── Redirect to Google consent page ─────────►│
     │                │                │                │
     │  User grants   │                │                │
     │  permission    │                │                │
     │────────────────────────────────►│                │
     │                │                │                │
     │  ◄─── Redirect to /auth/callback?code=xxx       │
     │                │                │                │
     │───────────────►│                │                │
     │                │  exchangeCodeForSession(code)   │
     │                │───────────────►│                │
     │                │                │                │
     │                │  ◄── JWT token + refresh token  │
     │                │  (set as HTTP-only cookies)     │
     │                │                │                │
     │  ◄── Redirect  │                │                │
     │   to /chat     │                │                │
     │                │                │                │
     │  GET /api/v1/auth/me            │                │
     │  Authorization: Bearer <jwt>    │                │
     │─────────────────────────────────────────────────►│
     │                │                │                │
     │                │                │     Verify JWT │
     │                │                │     (HS256,    │
     │                │                │      local)    │
     │                │                │                │
     │                │                │    Upsert user │
     │                │                │    in local DB │
     │                │                │                │
     │  ◄──── { id, email, display_name } ─────────────│
     │                │                │                │
```

**Key points:**
- JWT is verified locally in FastAPI using the Supabase JWT secret (HS256). No network call to Supabase at request time.
- Users are auto-created in the local PostgreSQL on first authenticated request.
- The middleware in Next.js refreshes the session token on every request and protects `/chat`, `/history`, and `/decks` routes.

### SSE Real-Time Updates Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Frontend │     │ Backend  │     │  Redis   │     │  Worker  │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │  EventSource   │                │                │
     │  /tasks/{id}/  │                │                │
     │  stream        │                │                │
     │───────────────►│                │                │
     │                │  SUBSCRIBE     │                │
     │                │  "task:{id}"   │                │
     │                │───────────────►│                │
     │                │                │                │
     │                │                │   PUBLISH      │
     │                │                │   "task:{id}"  │
     │                │                │◄───────────────│
     │                │                │  {status:      │
     │                │  ◄── message ──│  "parsing_     │
     │                │                │   intent"}     │
     │  ◄── SSE ──────│                │                │
     │  data: {...}   │                │                │
     │                │                │                │
     │  UI shows:     │                │   PUBLISH      │
     │  "Parsing      │                │◄───────────────│
     │   your         │  ◄── message ──│  "searching_   │
     │   request..."  │                │   cards"       │
     │  ◄── SSE ──────│                │                │
     │                │                │                │
     │  UI shows:     │                │   PUBLISH      │
     │  "Searching    │                │◄───────────────│
     │   for cards.." │  ◄── message ──│  "composing_   │
     │                │                │   deck"        │
     │  ◄── SSE ──────│                │                │
     │                │                │                │
     │  UI shows:     │                │   PUBLISH      │
     │  "Building     │                │◄───────────────│
     │   your deck.." │  ◄── message ──│  "completed"   │
     │                │                │                │
     │  ◄── SSE ──────│                │                │
     │                │  UNSUBSCRIBE   │                │
     │  EventSource   │───────────────►│                │
     │  closes        │                │                │
     │                │                │                │
     │  GET /decks/   │                │                │
     │  {deck_id}     │                │                │
     │───────────────►│                │                │
     │  ◄── deck ─────│                │                │
     │     data       │                │                │
```

**SSE Events:**

| Event               | Message                        | Description                            |
|----------------------|--------------------------------|----------------------------------------|
| `queued`             | "Queuing your request..."      | Task is in the Celery queue            |
| `parsing_intent`     | "Parsing your request..."      | Claude is extracting deck parameters   |
| `searching_cards`    | "Searching for cards..."       | Querying Scryfall for candidate cards  |
| `composing_deck`     | "Building your deck..."        | Claude is selecting and balancing cards |
| `enriching`          | "Fetching card images..."      | Fetching images/metadata from Scryfall |
| `completed`          | "Your deck is ready!"          | Deck generation finished               |
| `failed`             | Error message                  | Something went wrong                   |

---

## API Routes

All routes are prefixed with `/api/v1`. All routes except `/health` require a valid JWT in the `Authorization: Bearer <token>` header.

### Health

| Method | Path      | Auth | Description           | Response       |
|--------|-----------|------|-----------------------|----------------|
| GET    | `/health` | No   | Checks DB connectivity | `{ status: "healthy" }` |

### Authentication

| Method | Path       | Auth | Description                              | Response                                         |
|--------|------------|------|------------------------------------------|--------------------------------------------------|
| GET    | `/auth/me` | Yes  | Get current user (auto-creates if first visit) | `{ id, email, display_name, avatar_url }` |

### Decks

| Method | Path               | Auth | Description                    | Request Body                          | Response                                    |
|--------|--------------------|------|--------------------------------|---------------------------------------|---------------------------------------------|
| POST   | `/decks/generate`  | Yes  | Submit a deck generation request | `{ prompt: string, format?: string }` | `{ task_id, deck_id, status: "queued" }`    |
| GET    | `/decks`           | Yes  | List user's decks (paginated)  | Query: `?page=1&limit=20`             | `{ decks: [...], total, page, pages }`      |
| GET    | `/decks/{id}`      | Yes  | Get a single deck with all cards | —                                    | Full deck object (see schema below)         |
| DELETE | `/decks/{id}`      | Yes  | Delete a deck                  | —                                     | `204 No Content`                            |

**Deck Response Object:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "title": "Orzhov Angel Lifelink",
  "prompt": "Create a white and black angel deck with lifelink",
  "format": "standard",
  "colors": ["W", "B"],
  "cards": [
    {
      "name": "Angel of Vitality",
      "quantity": 4,
      "scryfall_id": "uuid",
      "image_uri": "https://cards.scryfall.io/normal/...",
      "mana_cost": "{2}{W}",
      "type_line": "Creature — Angel",
      "section": "creature"
    }
  ],
  "card_count": 60,
  "status": "completed",
  "error_message": null,
  "created_at": "2026-03-22T10:00:00Z",
  "completed_at": "2026-03-22T10:00:18Z"
}
```

### Tasks

| Method | Path                   | Auth | Description                  | Response                          |
|--------|------------------------|------|------------------------------|-----------------------------------|
| GET    | `/tasks/{id}/stream`   | Yes  | SSE stream of task progress  | `text/event-stream` (see above)   |

**SSE data format:**
```
data: {"status": "parsing_intent", "message": "Parsing your request..."}

data: {"status": "searching_cards", "message": "Searching for cards..."}

data: {"status": "completed", "message": "Your deck is ready!"}
```

---

## Database Schema

```
┌──────────────────────┐       ┌──────────────────────────────────┐
│       users          │       │            decks                 │
├──────────────────────┤       ├──────────────────────────────────┤
│ id          UUID  PK │◄──┐   │ id              UUID  PK         │
│ email       VARCHAR  │   ├──│ user_id         UUID  FK → users │
│ display_name VARCHAR │   │   │ title           VARCHAR          │
│ avatar_url  VARCHAR  │   │   │ prompt          TEXT             │
│ created_at  TIMESTAMP│   │   │ format          VARCHAR          │
│ updated_at  TIMESTAMP│   │   │ colors          VARCHAR[]        │
└──────────────────────┘   │   │ cards           JSONB            │
                           │   │ card_count      INTEGER          │
                           │   │ status          VARCHAR          │
                           │   │ error_message   TEXT             │
                           │   │ created_at      TIMESTAMP        │
                           │   │ completed_at    TIMESTAMP        │
                           │   └──────────┬───────────────────────┘
                           │              │
┌──────────────────────┐   │   ┌──────────┴───────────────────────┐
│       tasks          │   │   │        chat_messages             │
├──────────────────────┤   │   ├──────────────────────────────────┤
│ id          UUID  PK │   │   │ id              UUID  PK         │
│ deck_id     UUID  FK ├───┤   │ user_id         UUID  FK → users │
│ user_id     UUID  FK ├───┘   │ deck_id         UUID  FK → decks │
│ status      VARCHAR  │       │ role            VARCHAR          │
│ created_at  TIMESTAMP│       │ content         TEXT             │
│ updated_at  TIMESTAMP│       │ created_at      TIMESTAMP        │
└──────────────────────┘       └──────────────────────────────────┘
```

### Table Details

**users** — Synced from Supabase Auth on first login
- `id`: UUID from Supabase `auth.users.id`
- Auto-created when a user hits `GET /auth/me` for the first time

**decks** — Generated deck records
- `status`: `pending` → `generating` → `completed` | `failed`
- `cards`: JSONB array of `{ name, quantity, section, scryfall_id, image_uri, mana_cost, type_line }`
- `colors`: PostgreSQL array of single-char strings (`W`, `U`, `B`, `R`, `G`)

**tasks** — Tracks Celery task state (mirrors Celery for frontend consumption)
- `id`: Matches Celery task ID for correlation
- `status`: `queued` → `processing` → `completed` | `failed`

**chat_messages** — Chat history
- `role`: `"user"` or `"assistant"`
- `deck_id`: Links an assistant response to the generated deck

### Indexes
- `ix_users_email` on `users.email`
- `ix_decks_user_id` on `decks.user_id`
- `ix_tasks_deck_id` on `tasks.deck_id`
- `ix_tasks_user_id` on `tasks.user_id`
- `ix_chat_messages_user_id` on `chat_messages.user_id`

---

## External Services

### Scryfall API

**Base URL:** `https://api.scryfall.com`

| Endpoint             | Usage                                         | Rate Limit     |
|----------------------|-----------------------------------------------|----------------|
| `GET /cards/search`  | Search cards by query (colors, types, keywords)| 10 req/s       |
| `GET /cards/named`   | Fetch single card by exact name               | 10 req/s       |
| `POST /cards/collection` | Batch fetch up to 75 cards              | 10 req/s       |

**Caching Strategy:**
- All Scryfall responses are cached in Redis with a **24-hour TTL**
- Cache keys are `scryfall:{type}:{md5(query)}` (e.g., `scryfall:search:a1b2c3d4`)
- Rate limiting enforced at 100ms between requests

**Query Syntax Examples:**
- `c:wb t:Angel kw:lifelink` — White/Black Angels with lifelink keyword
- `c:wb (t:instant or t:sorcery)` — White/Black removal and interaction spells
- `t:land ci:wb` — Lands with White/Black color identity

### Claude API

**Model:** `claude-sonnet-4-20250514`

Used for two distinct calls per deck generation:

| Call | Purpose | Input | Output | ~Latency |
|------|---------|-------|--------|----------|
| **#1: Parse Intent** | Extract structured parameters from natural language | User prompt string | JSON: `{ colors, themes, creature_types, keywords, format, strategy }` | ~2s |
| **#2: Compose Deck** | Select and balance a deck from candidate cards | Candidate card list + intent + deck rules | JSON: `{ title, cards: [{ name, quantity, section }] }` | ~8s |

**Why not a custom model?** The deck generation task is a reasoning problem, not a pattern-matching one. Claude already understands MTG rules, card synergies, and deck-building strategy. Combined with real card data from Scryfall, there's no benefit to training a custom model.

**Hallucination prevention:** Claude only selects from cards provided by Scryfall search results. Every card name is verified against Scryfall's `/cards/named` endpoint in the enrichment step.

### Supabase Auth

**Purpose:** OAuth provider management and JWT issuance.

| Feature | Details |
|---------|---------|
| OAuth Providers | Google, GitHub |
| JWT Algorithm | HS256 |
| Token Verification | Local (FastAPI verifies using shared secret, no network call) |
| Session Management | HTTP-only cookies managed by `@supabase/ssr` |

**JWT Claims Used:**
- `sub` → User ID (UUID)
- `email` → User email
- `aud` → Must be `"authenticated"`
- `exp` → Token expiration

---

## Infrastructure

### Docker Compose

For local development with hot-reload. All 6 services in a single network:

```yaml
Services:
  postgres    → port 5432  (health check: pg_isready)
  redis       → port 6379  (health check: redis-cli ping)
  backend     → port 8000  (depends on: postgres, redis)
  worker      → no port    (depends on: postgres, redis)
  flower      → port 5555  (depends on: redis)
  frontend    → port 3000  (depends on: backend)
```

**Startup:** `make dev` (or `docker compose up --build`)

### Kubernetes (Kind)

Production-like setup with a 3-node local cluster.

**Cluster topology:**
```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Control Plane   │  │    Worker #1     │  │    Worker #2     │
│  (ingress-ready) │  │                  │  │                  │
│  Ports: 80, 443  │  │  Pods scheduled  │  │  Pods scheduled  │
│                  │  │  here            │  │  here            │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

**K8s Resources:**

| Resource       | Type         | Replicas | Notes                              |
|----------------|--------------|----------|------------------------------------|
| `postgres`     | StatefulSet  | 1        | PVC for persistent storage (1Gi)   |
| `redis`        | Deployment   | 1        | Memory limit: 256Mi                |
| `backend`      | Deployment   | 2        | Liveness/readiness on `/api/v1/health` |
| `worker`       | Deployment   | 2        | Horizontally scalable              |
| `frontend`     | Deployment   | 2        | Standalone Next.js output          |
| `flower`       | Deployment   | 1        | Celery monitoring                  |
| `ingress`      | Ingress      | —        | NGINX, buffering disabled for SSE  |

**Scaling workers:**
```bash
kubectl scale deployment worker -n magic-grimoire --replicas=4
```

**Commands:**
```bash
make kind-create    # Create cluster + install ingress controller
make build          # Build Docker images
make kind-load      # Load images into Kind
make kind-deploy    # Apply all k8s manifests (kubectl apply -k k8s/)
make kind-status    # Show all resources
make kind-destroy   # Delete cluster
```

---

## Project Structure

```
magic-grimoire/
│
├── backend/                          # Python FastAPI application
│   ├── app/
│   │   ├── main.py                   # FastAPI app entry point, CORS, router
│   │   ├── api/
│   │   │   ├── router.py             # Aggregates all routes under /api/v1
│   │   │   └── routes/
│   │   │       ├── auth.py           # GET /auth/me
│   │   │       ├── decks.py          # POST /generate, GET /, GET /{id}, DELETE /{id}
│   │   │       ├── tasks.py          # GET /{id}/stream (SSE)
│   │   │       └── health.py         # GET /health
│   │   ├── core/
│   │   │   ├── config.py             # Pydantic Settings (env vars)
│   │   │   ├── database.py           # SQLAlchemy async engine + session
│   │   │   └── security.py           # JWT verification, get_current_user dependency
│   │   ├── models/
│   │   │   ├── user.py               # User model
│   │   │   ├── deck.py               # Deck model (JSONB cards, ARRAY colors)
│   │   │   ├── task.py               # Task model
│   │   │   └── chat_message.py       # ChatMessage model
│   │   ├── schemas/
│   │   │   ├── deck.py               # DeckGenerateRequest, DeckResponse, CardInDeck
│   │   │   └── task.py               # TaskResponse
│   │   ├── services/
│   │   │   ├── deck_generator.py     # Orchestrates the 5-step generation pipeline
│   │   │   ├── claude_service.py     # Intent parsing + deck composition (Claude API)
│   │   │   ├── scryfall_service.py   # Card search, caching, rate limiting (Scryfall API)
│   │   │   └── redis_cache.py        # Generic Redis cache get/set with TTL
│   │   └── workers/
│   │       ├── celery_app.py         # Celery configuration, autodiscovery
│   │       └── tasks.py              # generate_deck_task (Celery task)
│   ├── alembic/
│   │   ├── env.py                    # Migration environment (imports all models)
│   │   └── versions/
│   │       └── 001_initial.py        # Creates all 4 tables + indexes
│   ├── alembic.ini                   # Alembic configuration
│   ├── requirements.txt              # Python dependencies
│   └── Dockerfile                    # Python 3.13-slim, pip install, uvicorn CMD
│
├── frontend/                         # Next.js 15 TypeScript application
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx            # Root layout, dark theme, metadata
│   │   │   ├── page.tsx              # Root redirect (→ /chat or /login)
│   │   │   ├── login/page.tsx        # OAuth login (Google, GitHub)
│   │   │   ├── chat/page.tsx         # Main chat UI + deck generation
│   │   │   ├── history/page.tsx      # Deck history list with pagination
│   │   │   ├── decks/[id]/page.tsx   # Deck detail view with card images
│   │   │   ├── auth/callback/route.ts # Supabase OAuth callback handler
│   │   │   └── globals.css           # CSS variables for grimoire theme
│   │   ├── components/
│   │   │   ├── Navbar.tsx            # Top navigation bar
│   │   │   ├── ChatInput.tsx         # Text input + submit button
│   │   │   ├── ChatMessage.tsx       # Single chat bubble (user/assistant)
│   │   │   ├── DeckDisplay.tsx       # Full deck view grouped by card type
│   │   │   ├── CardTile.tsx          # Single card with image + metadata
│   │   │   └── DeckSkeleton.tsx      # Loading skeleton during generation
│   │   ├── lib/
│   │   │   ├── api.ts                # API client (fetch + JWT headers + SSE)
│   │   │   └── supabase/
│   │   │       ├── client.ts         # Browser Supabase client
│   │   │       ├── server.ts         # Server Supabase client
│   │   │       └── middleware.ts     # Session refresh + route protection
│   │   ├── types/index.ts            # TypeScript interfaces
│   │   └── middleware.ts             # Next.js middleware entry point
│   ├── next.config.ts                # Standalone output, Scryfall image domain
│   ├── tsconfig.json
│   ├── postcss.config.mjs
│   ├── package.json
│   └── Dockerfile                    # Multi-stage: deps → build → production
│
├── k8s/                              # Kubernetes manifests
│   ├── namespace.yaml                # magic-grimoire namespace
│   ├── configmap.yaml                # Non-secret config (DB URL, Redis URL)
│   ├── secrets.yaml.example          # Template for API keys (not committed)
│   ├── postgres.yaml                 # StatefulSet + headless Service
│   ├── redis.yaml                    # Deployment + Service
│   ├── backend.yaml                  # Deployment (2 replicas) + Service
│   ├── worker.yaml                   # Deployment (2 replicas, no Service)
│   ├── frontend.yaml                 # Deployment (2 replicas) + Service
│   ├── flower.yaml                   # Deployment + Service
│   ├── ingress.yaml                  # NGINX Ingress rules
│   └── kustomization.yaml            # Kustomize resource list
│
├── docker-compose.yml                # Local dev: all 6 services
├── kind-config.yaml                  # 3-node cluster (1 CP + 2 workers)
├── Makefile                          # dev, build, migrate, kind-* commands
├── .env.example                      # Environment variable template
├── .gitignore
└── README.md
```

---

## Frontend Pages

| Route             | Component                | Auth Required | Description                                  |
|-------------------|--------------------------|---------------|----------------------------------------------|
| `/`               | `page.tsx`               | No            | Redirects to `/chat` (logged in) or `/login` |
| `/login`          | `login/page.tsx`         | No            | Google/GitHub OAuth buttons                  |
| `/auth/callback`  | `auth/callback/route.ts` | No            | Handles OAuth redirect, sets session cookies |
| `/chat`           | `chat/page.tsx`          | Yes           | Chat interface + deck generation + SSE       |
| `/history`        | `history/page.tsx`       | Yes           | Paginated list of all user decks             |
| `/decks/[id]`     | `decks/[id]/page.tsx`    | Yes           | Full deck view with card images, copy export |

---

## Environment Variables

| Variable                        | Required | Used By          | Description                          |
|---------------------------------|----------|------------------|--------------------------------------|
| `SUPABASE_URL`                  | Yes      | Backend          | Supabase project URL                 |
| `SUPABASE_ANON_KEY`            | Yes      | Backend          | Supabase anonymous API key           |
| `SUPABASE_JWT_SECRET`          | Yes      | Backend          | JWT signing secret (HS256)           |
| `ANTHROPIC_API_KEY`            | Yes      | Backend, Worker  | Claude API key for deck generation   |
| `DATABASE_URL`                 | Yes      | Backend, Worker  | PostgreSQL connection string         |
| `REDIS_URL`                    | Yes      | Backend, Worker  | Redis for cache + SSE pub/sub        |
| `CELERY_BROKER_URL`           | Yes      | Worker           | Redis URL for Celery message broker  |
| `CELERY_RESULT_BACKEND`       | Yes      | Worker           | Redis URL for Celery result storage  |
| `NEXT_PUBLIC_SUPABASE_URL`    | Yes      | Frontend         | Supabase URL (exposed to browser)    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| Yes     | Frontend         | Supabase key (exposed to browser)    |
| `NEXT_PUBLIC_API_URL`         | Yes      | Frontend         | Backend API base URL                 |
