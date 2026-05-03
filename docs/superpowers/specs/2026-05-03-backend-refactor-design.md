# Backend Refactor Design — 2026-05-03

## Summary

Refactor the `api-server` backend to fix critical bugs, add proper structure (enums, typed DTOs, auth middleware), implement JWT validation, add a real chat endpoint, and enforce MTG-topic input sanitization.

**Decisions made:**
- Keep Celery (persistent tasks, retries, Flower monitoring)
- No polling — SSE remains the streaming mechanism
- Real `POST /chat` endpoint backed by Claude/Ollama
- Soft auth — guests can generate once (IP rate-limit), `user_id` nullable on Deck
- Input guard: rule-based pre-filter + LLM system-prompt enforcement
- HTTP POST for chat (no WebSockets; SSE token streaming is an easy future upgrade)
- Modular structure — new `auth/`, `chat/` modules alongside existing `decks/`, `tasks/`

---

## 1. Module Structure

```
app/
├── core/
│   ├── config.py        # + SUPABASE_JWT_SECRET, JWT_ALGORITHM
│   ├── database.py      # unchanged
│   ├── enums.py         # NEW — DeckStatus, TaskStatus, DeckFormat, TaskType
│   └── guards.py        # NEW — sanitize_prompt()
├── auth/
│   └── dependencies.py  # NEW — get_optional_user(), get_current_user()
├── chat/
│   ├── dtos.py          # NEW — ChatMessageDTO, ChatRequestDTO, ChatResponseDTO
│   ├── routes.py        # NEW — POST /api/v1/chat
│   └── service.py       # NEW — chat_with_grimoire()
├── decks/
│   ├── dtos.py          # updated — use enums
│   ├── model.py         # updated — user_id (nullable), enums
│   ├── routes.py        # updated — auth dep, explicit commit, guards
│   └── worker.py        # updated — module-level engine, enums, failed_at fix
├── tasks/
│   ├── dtos.py          # updated — use enums
│   ├── model.py         # updated — enums, datetime.now(UTC)
│   └── routes.py        # unchanged
├── services/
│   └── llm/
│       ├── base.py      # + chat() abstract method
│       ├── claude.py    # + chat() implementation
│       └── ollama.py    # + chat() implementation
└── workers/
    └── celery_app.py    # unchanged
```

New Alembic migration: add nullable `user_id` column to `decks` table.

---

## 2. Enums (`app/core/enums.py`)

Single source of truth. All raw status strings replaced throughout the codebase.

```python
class DeckStatus(StrEnum):
    PENDING    = "pending"
    PROCESSING = "processing"
    COMPLETED  = "completed"
    FAILED     = "failed"

class TaskStatus(StrEnum):
    QUEUED     = "queued"
    PROCESSING = "processing"
    COMPLETED  = "completed"
    FAILED     = "failed"

class DeckFormat(StrEnum):
    STANDARD  = "standard"
    MODERN    = "modern"
    PIONEER   = "pioneer"
    LEGACY    = "legacy"
    COMMANDER = "commander"

class TaskType(StrEnum):
    GENERATE_DECK = "generate_deck"
```

---

## 3. Auth Module (`app/auth/dependencies.py`)

Supabase JWTs are HS256-signed. Payload contains `sub` (user UUID) and `aud = "authenticated"`.

**Two FastAPI dependencies:**

- `get_optional_user(credentials) -> str | None` — returns `user_id` if token is valid, `None` for guests. Never raises.
- `get_current_user(credentials) -> str` — returns `user_id` or raises HTTP 401.

**Config additions (`app/core/config.py`):**
```python
SUPABASE_JWT_SECRET: str = ""
JWT_ALGORITHM: str = "HS256"
```

**Deck model change (`app/decks/model.py`):**
```python
user_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
```

**Route-level auth:**

| Endpoint | Dependency | Behaviour |
|---|---|---|
| `POST /decks/generate` | `get_optional_user` | Sets `deck.user_id` if authenticated; guest gets IP rate-limit |
| `GET /decks` | `get_current_user` | Returns only caller's decks |
| `GET /decks/:id` | `get_optional_user` | Returns deck if owner matches or deck is anonymous |
| `DELETE /decks/:id` | `get_current_user` | Owner-only |
| `POST /chat` | `get_optional_user` | Guests can chat |

---

## 4. Input Guard (`app/core/guards.py`)

**`sanitize_prompt(text: str) -> tuple[bool, str]`** — returns `(is_valid, rejection_message)`.

**Layer 1 — Rule-based (always runs, <1ms):**
Rejects on regex-matched injection patterns:
- `ignore (previous|all|prior) instructions`
- `system prompt`
- `jailbreak`
- `you are now`
- `act as [non-MTG entity]`
- `<script`, `javascript:`

Does **not** do keyword-based topic rejection — short creative prompts ("surprise me", "something spicy") are valid MTG requests.

**Layer 2 — LLM system prompt:**
Both `parse_intent` and `chat()` system prompts include a hard instruction: if the message is not about MTG deck-building, cards, formats, or strategy, return `{"error": "off_topic", "message": "I only discuss Magic: The Gathering. How can I help you build a deck?"}`.

When the LLM returns `{"error": "off_topic"}`, the endpoint returns HTTP 400 with the message. No Celery task is created, no Scryfall is called.

**Applied at:**
- `POST /decks/generate` — before task dispatch (fast rejection)
- `POST /chat` — on the last user message before LLM call

---

## 5. Chat Module

### DTOs (`app/chat/dtos.py`)

```python
class ChatMessageDTO(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=2000)

class ChatContextDTO(BaseModel):
    format: DeckFormat | None = None
    colors: list[str] | None = None
    strategy: str | None = None

class ChatRequestDTO(BaseModel):
    messages: list[ChatMessageDTO] = Field(..., min_length=1, max_length=20)
    context: ChatContextDTO | None = None

class ChatResponseDTO(BaseModel):
    message: str
```

`messages` is the full conversation history. Max 20 messages prevents token abuse. `context` carries the options panel state.

### Service (`app/chat/service.py`)

`chat_with_grimoire(messages, context) -> str`

Builds a dynamic system prompt: MTG assistant persona + topic guard + context injection ("The user is building a {format} deck, leaning toward colors {colors}, strategy {strategy}"). Calls `LLMService.chat(messages, system_prompt)`.

### LLM base (`app/services/llm/base.py`)

New abstract method:
```python
@abstractmethod
def chat(self, messages: list[dict], system: str) -> str: ...
```

`ClaudeService.chat()` uses `client.messages.create()` with full history.  
`OllamaService.chat()` uses the `/api/chat` endpoint.

### Route (`app/chat/routes.py`)

```
POST /api/v1/chat
Request:  ChatRequestDTO
Response: ChatResponseDTO (200) | {"detail": "..."} (400 off-topic | 422 validation)
Auth:     get_optional_user
```

Synchronous — no task, no Celery. Chat responses are fast (<2s). SSE token streaming is a future upgrade if wanted.

---

## 6. Bug Fixes + Celery Worker Cleanup

### Fix 1 — Transaction race condition (`decks/routes.py`)
`db.flush()` writes to session but doesn't commit. The Celery task starts immediately and can't find the Task record. **Fix:** explicit `await db.commit()` before `generate_deck_task.delay(...)`.

### Fix 2 — New DB engine on every task (`decks/worker.py`)
`_make_session()` called `create_async_engine()` on every invocation, leaking connections. **Fix:** module-level engine and session factory singletons, created once at worker process start.

### Fix 3 — `failed_at` never set (`decks/worker.py`)
`Deck.failed_at` column exists but was never populated on failure. **Fix:** set `deck.failed_at = datetime.now(UTC)` and `task.failed_at = datetime.now(UTC)` in the except block.

### Fix 4 — Deprecated `datetime.utcnow` (`tasks/model.py`)
`onupdate=datetime.utcnow` is deprecated in Python 3.12+ and produces naive datetimes. **Fix:** `onupdate=lambda: datetime.now(UTC)`.

### Fix 5 — Off-topic guard in worker (`decks/worker.py`)
If `parse_intent` returns `{"error": "off_topic"}` (edge case: passed layer-1 rule filter but caught by LLM system prompt), the worker currently proceeds with an empty intent. **Fix:** after `parse_intent` returns, check `if intent.get("error")` and raise a `ValueError` with the LLM's message. This propagates through the except block, storing the message in `deck.error_message` and publishing `{"status": "failed", "message": "I only discuss Magic: The Gathering."}` to the SSE channel.

### Celery worker — status publishing helper
Extract pub/sub + status update into a small `_update_and_publish()` helper to reduce repetition across the pipeline steps. No logic change, just readability.

---

## Out of Scope

- SSE token streaming for chat (HTTP POST is sufficient; streaming is a one-endpoint upgrade)
- WebSocket unified channel
- Deck claiming (associating anonymous decks with a user on sign-in)
- Rate limiting for authenticated users
