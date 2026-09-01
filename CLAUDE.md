# CLAUDE.md — Magic Grimoire

AI-powered Magic: The Gathering deck generator. Users describe a deck in natural language; the system generates a balanced 60-card deck using real MTG cards via Anthropic Claude + Scryfall.

---

**Documentation workflow:** see `docs/documentation-guide.md` for how to generate Obsidian notes, ADR conventions, and folder structure.

---

## Repo Layout

```
magic-grimoire/
├── apps/
│   ├── api-server/     # FastAPI + Celery (Python 3.13)
│   └── web-app/        # Next.js 15 + TypeScript
├── packages/           # Shared Node packages (empty — placeholder for future)
├── docs/               # Obsidian knowledge base (see docs/CLAUDE.md)
├── .claude/            # Claude Code skills (/adr, /prd)
├── .obsidian/          # Obsidian vault config
├── .github/            # CI workflows
├── Makefile            # Unified entry point: make dev / test / build / lint
└── docker-compose.yml
```

---

## Backend (`apps/api-server/`)

**Entry point:** `apps/api-server/app/main.py` → mounts all routers via `router.py`

**Structure:**
```
apps/api-server/app/
├── core/
│   ├── config.py       # Settings from env vars (Pydantic BaseSettings)
│   └── database.py     # Async SQLAlchemy engine + session factory
├── llm/                # LLM abstraction: claude.py, ollama.py, factory.py
├── services/
│   ├── scryfall_service.py  # Scryfall API: search_cards(), enrich_cards()
│   └── redis_cache.py       # Redis get/set helpers
├── decks/
│   ├── model.py    # Deck ORM model
│   ├── routes.py   # POST /decks/generate, GET /decks, GET /decks/:id, DELETE /decks/:id
│   ├── dtos.py     # Request/response Pydantic schemas
│   └── worker.py   # Celery task: generate_deck_task()
├── tasks/
│   ├── model.py    # Task ORM model
│   ├── routes.py   # GET /tasks/:id/stream (SSE)
│   └── dtos.py
└── workers/
    └── celery_app.py   # Celery app instance + broker config
```

**Key pattern — deck generation pipeline (Celery worker):**
1. `parse_intent(prompt)` → LLM → colors, creature_types, keywords, strategy
2. `search_cards(intent)` → Scryfall API (Redis-cached, 24h TTL)
3. `compose_deck(intent, cards, format)` → LLM → 60-card list
4. `enrich_cards(cards)` → Scryfall API per card (Redis-cached)
5. Save Deck + Task to PostgreSQL, publish `completed` to Redis Pub/Sub

Each step publishes a progress event to Redis Pub/Sub (`task:{id}`) which is streamed to the client via SSE at `GET /tasks/:id/stream`.

**Database:** PostgreSQL 16, async via `asyncpg`. Models in `*/model.py`. Migrations in `alembic/`.

**Auth:** JWT from Supabase, validated in middleware. `user_id` extracted from token.

**Package manager:** `uv`. Dependencies in `pyproject.toml`.

---

## Frontend (`apps/web-app/`)

**Framework:** Next.js 15 App Router, TypeScript, CSS Modules + CSS custom
properties. **No Tailwind** — design tokens live in `app/globals.css` and are
documented in `apps/web-app/docs/tokens.md`.

```
apps/web-app/app/
├── layout.tsx              # Root layout: Header + ThemeProvider + UserProvider
├── page.tsx                # Landing page
├── deck-builder/           # Deck generation screen
├── library/                # Saved decks (auth-gated, has its own layout)
├── login/  signup/         # Auth screens
├── pricing/                # Pricing tiers
├── context/
│   ├── UserContext.tsx     # Auth/user state
│   └── ThemeContext.tsx    # Light/dark theme
├── lib/
│   ├── apiClient.ts        # Typed fetch wrapper for the FastAPI backend
│   ├── supabase.ts         # Supabase client
│   └── mockAuth.ts         # NEXT_PUBLIC_MOCK_AUTH dev bypass — never deploy enabled
├── components/             # One dir per component, each with its .module.css
│   ├── Button/ Card/ Input/ Select/ Modal/ Badge/ Spinner/   # primitives
│   ├── Header/ Footer/ ThemeToggle/ MockAuthBanner/          # shell
│   └── ArcaneSigil/ ManaIcon/ ManaSymbol/ ManaCurve/ CardTile/ DeckSummaryCard/
└── hooks/
    ├── useTaskStream.ts     # SSE subscription + progress reducer
    └── useAutoScroll.ts     # Auto-scroll on new content
```

**Auth:** Supabase Auth (Google + GitHub OAuth). JWT passed as `Authorization: Bearer` header to the backend. Setting `NEXT_PUBLIC_MOCK_AUTH=true` in `.env.local` bypasses it for local UI work.

**Real-time:** Connects to `GET /tasks/:id/stream` (SSE) to receive deck generation progress events. No polling.

---

## Infrastructure

| Service | Port | Purpose |
|---|---|---|
| FastAPI | 8000 | REST API |
| Next.js | 3000 | Frontend |
| PostgreSQL | 5432 | Primary DB |
| Redis | 6379 | Celery broker + cache + Pub/Sub |
| Flower | 5555 | Celery monitoring UI |

**Local dev:** `docker-compose.yml` at repo root. All services have health checks. Run with `make dev`.

**CI:** `.github/workflows/` — `api-server.yml` (pytest, paths: `apps/api-server/**`), `web-app.yml` (lint + build, paths: `apps/web-app/**`), `gitleaks.yml` (secret scan).

---

## Key Conventions

- **Python:** async throughout. Never use sync SQLAlchemy calls inside async routes.
- **DTOs:** Pydantic schemas in `dtos.py`, never expose ORM models directly.
- **Redis cache keys:** `scryfall:search:{query}` and `scryfall:card:{name}`. TTL = 24h.
- **Task status values:** `queued` → `processing` → `completed` | `failed`
- **Deck status values:** `pending` → `processing` → `completed` | `failed`
- **Env vars:** defined in `apps/api-server/app/core/config.py`. Backend `.env` at `apps/api-server/.env`.
