# API Server Refactor + Test Suite — Design

**Date:** 2026-07-11
**Scope:** `apps/api-server/` only (plus its CI workflow). No frontend changes.

## Goal

The api-server was largely AI-generated with minimal testing. This work: (1) fixes three
confirmed bugs, (2) refactors for readability while preserving behavior, and (3) builds a
pytest suite split into unit tests (no infrastructure) and integration tests (real Postgres).

## Decisions Made

| Decision | Choice |
|---|---|
| Refactor depth | Targeted refactor — keep current architecture, no new service/repository layers |
| Test infrastructure | Unit tests fully mocked; integration tests against real Postgres (docker-compose locally, service container in CI) |
| External services in tests | Mock at HTTP layer (respx for Scryfall/Ollama, mocked Anthropic SDK client); Redis via fakeredis |
| SSE stream auth | Capability URL — endpoint stays tokenless. Task IDs are unguessable UUIDv4 and events carry only progress strings, never deck data. Frontend's native `EventSource` cannot send auth headers. Document decision in code. |

## 1. Bug Fixes

1. **`delete_deck` never deletes** — `db.delete(deck)` in `app/decks/routes.py` is missing
   `await` (coroutine in async SQLAlchemy). Endpoint returns 204 but the row survives.
   Fix: `await db.delete(deck)`. Regression test in integration suite.
2. **CORS misconfiguration** — `allow_origins=["*"]` with `allow_credentials=True` in
   `main.py` is invalid per the CORS spec and insecure. Fix: new `ALLOWED_ORIGINS` setting
   (default `http://localhost:3000`), parsed into an explicit origin list.
3. **SSE stream endpoint auth** — resolved as capability URL (see table). Code comment only.

## 2. Refactor (behavior-preserving)

- **`app/services/llm/prompts.py` (new)** — single home for the 5 prompt constants
  (`_OFF_TOPIC_INSTRUCTION`, `PARSE_INTENT_SYSTEM`, `PARSE_INTENT_TEMPLATE`,
  `COMPOSE_DECK_SYSTEM`, `COMPOSE_DECK_TEMPLATE`, `CHAT_SYSTEM`) currently duplicated
  verbatim in `claude.py` and `ollama.py` (~90 lines). Both providers import from it.
  `chat/service.py` imports `CHAT_SYSTEM` from `prompts`, not from the Claude module.
- **`app/decks/worker.py`** — extract `_mark_failed(...)` and `_save_completed_deck(...)`
  helpers so `_run_generate_deck` reads top-to-bottom as the 5 pipeline steps. Replace the
  silent `except Exception: pass` with a logged warning.
- **`app/services/redis_cache.py`** — module-level connection pool instead of a new client
  per call. Public API unchanged (`get` / `set` / `publish`).
- **Small cleanups** — drop client-side `default=` where `server_default=` exists on ORM
  models; remove the redundant `finally: session.close()` in `get_db` (the context manager
  already closes); hoist the `generate_deck_task` import in `decks/routes.py` to module
  level if no circular import prevents it (verify); consistent logger naming.

Not doing (YAGNI): repository layer, DI for LLM/Redis, changing the guest rate-limit
policy (1 deck / 30 days / IP — assumed intentional), any frontend work.

## 3. Test Suite

```
tests/
├── conftest.py                   # env vars, shared fixtures, fakeredis wiring
├── unit/                         # no infrastructure required
│   ├── test_guards.py                (moved, kept)
│   ├── test_auth_dependencies.py     (moved, kept)
│   ├── test_chat_routes.py           (moved, kept)
│   ├── test_llm_prompts.py           # factory selection, prompt sanity
│   ├── test_llm_claude.py            # mocked Anthropic client: JSON parsing, off-topic
│   ├── test_llm_ollama.py            # respx: request shape, JSON parsing, HTTP errors
│   ├── test_scryfall_service.py      # respx: query building, pagination cap, dedupe,
│   │                                 #   404→empty, cache hit/miss, enrich failure→passthrough
│   ├── test_chat_service.py          # context string building, off-topic unwrap
│   └── test_deck_routes_unit.py      # validation, injection rejection, guest rate-limit
│                                     #   429 branch (mocked db + fakeredis)
└── integration/                  # @pytest.mark.integration, requires Postgres
    ├── conftest.py               # session-scoped engine, create/drop tables, db fixture
    ├── test_deck_routes_db.py    # generate persists Deck+Task; list pagination/ownership;
    │                             #   get 404/403; delete removes row (await-bug regression)
    ├── test_task_stream.py       # 404, already-completed short-circuit, live event
    │                             #   replay via fakeredis pub/sub
    └── test_worker_pipeline.py   # _run_generate_deck end-to-end with mocked LLM +
                                  #   respx Scryfall, real DB: success and failure paths
```

**Edge cases pinned down by tests:**
- Broker down during `POST /decks/generate` → 503 and deck+task marked failed.
- LLM returns invalid JSON or off-topic in worker → deck failed with error message.
- Scryfall search 404 → empty candidate list, no crash.
- Card enrichment HTTP failure → card kept without enrichment fields.
- Guest second generation within TTL → 429.

**New dev dependencies:** `fakeredis`, `respx` (pytest, pytest-asyncio already present).

**CI:** `api-server.yml` gains a `postgres:16` service container with health check;
pytest runs both suites (`uv run pytest`). Locally, integration tests use the existing
docker-compose Postgres; unit tests run with no services.

## 4. Success Criteria

- `uv run pytest tests/unit` passes with no Docker running.
- `uv run pytest` passes locally with docker-compose Postgres up, and in CI.
- `make lint-api-server` (ruff) passes.
- API behavior unchanged except: DELETE actually deletes; CORS restricted to configured origins.
