# Backend Workflow

## Fluxogram

```
┌─────────────────────────────────────────────────────────────────────┐
│                              CLIENT                                  │
└───────────────┬─────────────────────────────────┬───────────────────┘
                │ POST /decks/generate              │ GET /tasks/:id/stream
                ▼                                   ▼
┌────────────────────────────┐         ┌─────────────────────────────┐
│   POST /decks/generate     │         │   SSE Stream                │
│                            │         │  ┌───────────────────────┐  │
│  Create Deck (pending)  ───┼──► PostgreSQL  │ Subscribe to Redis    │  │
│  Create Task (queued)   ───┼──► PostgreSQL  │ Pub/Sub task:{id}     │  │
│  Enqueue task           ───┼──► Redis (broker)  └──────────┬────────────┘  │
│                            │         │             │ SSE events    │
│  Return 202 {task_id,      │         └─────────────┼───────────────┘
│              deck_id}      │                       │
└────────────────────────────┘                       │
                                                      │
┌─────────────────────────────────────────────────────┼──────────────┐
│  CELERY WORKER                                       │              │
│                                                      │              │
│  ┌──────────────────────────────────────────────┐   │              │
│  │ [1] Mark Task → processing                   │   │              │
│  │         │  publish: "parsing_intent"  ─────────┼──┘              │
│  │         ▼                                    │                   │
│  │ [2] claude_service.parse_intent(prompt)      │                   │
│  │         │  → Anthropic API                   │                   │
│  │         │  → colors, keywords, themes        │                   │
│  │         │  publish: "searching_cards" ─────────┼──► Pub/Sub      │
│  │         ▼                                    │                   │
│  │ [3] scryfall_service.search_cards(intent)    │                   │
│  │         │  → Redis cache hit? ──► return     │                   │
│  │         │  → cache miss? ──► Scryfall API    │                   │
│  │         │                    store in cache  │                   │
│  │         │  publish: "composing_deck"  ─────────┼──► Pub/Sub      │
│  │         ▼                                    │                   │
│  │ [4] claude_service.compose_deck(...)         │                   │
│  │         │  → Anthropic API                   │                   │
│  │         │  → title + 60-card list            │                   │
│  │         │  publish: "enriching"  ──────────────┼──► Pub/Sub      │
│  │         ▼                                    │                   │
│  │ [5] scryfall_service.enrich_cards(cards)     │                   │
│  │         │  → Scryfall API (per card)         │                   │
│  │         │  → image_uri, mana_cost, type_line │                   │
│  │         ▼                                    │                   │
│  │ [6] Save to DB                               │                   │
│  │         │  → Deck: cards, status=completed   │                   │
│  │         │  → Task: status=completed          │                   │
│  │         │  publish: "completed"  ──────────────┼──► Pub/Sub      │
│  └──────────────────────────────────────────────┘                   │
│                                                                      │
│  On error:                                                           │
│    → Deck: status=failed, error_message stored                       │
│    → Task: status=failed                                             │
│    → publish: "failed"  ────────────────────────────► Pub/Sub       │
└──────────────────────────────────────────────────────────────────────┘
                                        │
                           ┌────────────┘
                           │ SSE delivers events to client in real-time
                           ▼
              ┌────────────────────────┐
              │  CLIENT receives:      │
              │  · parsing_intent      │
              │  · searching_cards     │
              │  · composing_deck      │
              │  · enriching           │
              │  · completed / failed  │
              └────────────┬───────────┘
                           │ GET /decks/:id
                           ▼
              ┌────────────────────────┐
              │  Full deck response    │
              │  with enriched cards   │
              └────────────────────────┘
```

---

## Overview

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI (async) |
| Database | PostgreSQL + asyncpg + SQLAlchemy |
| Task Queue | Celery + Redis |
| Cache | Redis (24h TTL) |
| Real-time | Redis Pub/Sub + SSE |
| AI | Anthropic API (Claude Sonnet) |
| Card Data | Scryfall API |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Database health check |
| POST | `/api/v1/decks/generate` | Queue deck generation |
| GET | `/api/v1/decks` | List user decks |
| GET | `/api/v1/decks/:id` | Get single deck |
| DELETE | `/api/v1/decks/:id` | Delete deck |
| GET | `/api/v1/tasks/:id/stream` | SSE progress stream |

---

## Deck Generation Flow

### Step 1 — Client requests deck generation

```
POST /api/v1/decks/generate
{
  "prompt": "aggressive goblin tribal deck",
  "format": "standard"
}
```

- Creates `Deck` record with `status = pending`
- Creates `Task` record with `status = queued`
- Enqueues `generate_deck_task` to Redis/Celery
- Returns `202 Accepted` with `task_id` and `deck_id`

---

### Step 2 — Client subscribes to progress

```
GET /api/v1/tasks/:id/stream
```

- Opens an SSE connection
- FastAPI subscribes to Redis Pub/Sub channel `task:{task_id}`
- Streams JSON events to client as they arrive
- Sends keepalive pings every 30s
- Closes stream when status is `completed` or `failed`

---

### Step 3 — Celery worker executes the pipeline

```
[1] Mark task → processing
        ↓
[2] claude_service.parse_intent(prompt)
    → Calls Anthropic API
    → Returns: colors, creature_types, keywords, themes, strategy
        ↓
[3] scryfall_service.search_cards(intent)
    → Check Redis cache (key: scryfall:search:{query})
    → On miss: fetch Scryfall API (up to 5 pages, ~350 cards)
    → Store result in cache (24h TTL)
    → Returns candidate card list
        ↓
[4] claude_service.compose_deck(intent, cards, format)
    → Calls Anthropic API
    → Returns: title + 60-card deck [{name, quantity, section}]
        ↓
[5] scryfall_service.enrich_cards(deck_cards)
    → Fetch each card by exact name from Scryfall
    → Check Redis cache per card (key: scryfall:card:{name})
    → Enriches with: image_uri, mana_cost, type_line, scryfall_id
        ↓
[6] Save to DB
    → Deck: cards = enriched list, status = completed
    → Task: status = completed
```

Each step publishes a progress event to Redis Pub/Sub:

| Step | Status event |
|------|-------------|
| 1 | `parsing_intent` |
| 2 | `searching_cards` |
| 3 | `composing_deck` |
| 4 | `enriching` |
| 5 | `completed` / `failed` |

---

### Step 4 — Client fetches completed deck

```
GET /api/v1/decks/:id
→ Returns full deck with enriched cards, colors, title, card_count
```

---

## Error Handling

If any step in the Celery pipeline fails:

- `Deck.status` → `failed`, `error_message` is stored
- `Task.status` → `failed`
- Redis Pub/Sub publishes `{ "status": "failed", "message": "..." }`
- SSE stream closes on the client side

---

## Data Models

### `users`
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Supabase user ID |
| email | String | Unique, indexed |
| display_name | String | Nullable |
| avatar_url | String | Nullable |

### `decks`
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Auto-generated |
| user_id | UUID | FK → users |
| title | String | Generated by Claude |
| prompt | Text | Original user input |
| format | String | MTG format |
| colors | String[] | Parsed color identity |
| cards | JSONB | Enriched card list |
| card_count | Integer | Total cards |
| status | String | pending / processing / completed / failed |
| error_message | Text | Nullable |

### `tasks`
| Field | Type | Notes |
|-------|------|-------|
| id | String | Celery task UUID |
| deck_id | UUID | FK → decks |
| user_id | UUID | FK → users |
| status | String | queued / processing / completed / failed |
