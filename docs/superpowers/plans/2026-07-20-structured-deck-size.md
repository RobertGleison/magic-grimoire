# Structured Deck Size Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send the OptionsPanel's deck-size stepper value to `/decks/generate` as a structured field, and make `compose_deck`'s LLM prompt use the real requested size everywhere it currently hardcodes "60" — fixing a real bug where Commander decks get contradictory 60-vs-100 instructions in the same request.

**Architecture:** Backend: `compose_deck`'s two prompt templates (`COMPOSE_DECK_SYSTEM`, `COMPOSE_DECK_TEMPLATE`) become parameterized by `deck_size`; a validated `deck_size` field on `DeckGenerateRequestDTO` threads unchanged through the route → Celery task → `DeckGenerationPipeline`, which passes it straight into `compose_deck` (no LLM-guess to override, unlike colors — deck size is a direct client parameter with a plain default of 60). Frontend: `deck-builder/page.tsx` sends `deck_size` structurally and retires the now-fully-dead prompt-text-folding code that colors already gutted.

**Tech Stack:** FastAPI + Pydantic + Celery + pytest (backend, `uv run pytest`); Next.js/TypeScript (frontend, `npm test`).

---

## File Map

| File | Change |
|---|---|
| `apps/api-server/app/services/llm/prompts.py` | Parameterize `COMPOSE_DECK_SYSTEM`/`COMPOSE_DECK_TEMPLATE` with `{deck_size}` |
| `apps/api-server/app/services/llm/base.py` | `compose_deck` gains `deck_size: int`, formats both templates with it |
| `apps/api-server/tests/unit/test_llm_claude.py` | Fix existing `compose_deck` call site (now needs 4 args); add deck-size assertion test |
| `apps/api-server/tests/unit/test_llm_ollama.py` | Fix existing `compose_deck` call site |
| `apps/api-server/app/decks/pipeline.py` | Fix the real (unmocked) `compose_deck` call site with a literal `60` stopgap — required immediately by Task 1's signature change, not deferrable to Task 3 |
| `apps/api-server/app/decks/dtos.py` | Add `deck_size: int = Field(default=60, ge=60)` |
| `apps/api-server/tests/unit/test_deck_routes_unit.py` | New validation test |
| `apps/api-server/app/decks/routes.py` | Forward `deck_size` in `apply_async` |
| `apps/api-server/tests/integration/test_deck_routes_db.py` | New broker-forwarding test |
| `apps/api-server/app/decks/worker.py` | Accept `deck_size`, pass to pipeline |
| `apps/api-server/app/decks/pipeline.py` | Accept `deck_size`, pass to `compose_deck` |
| `apps/api-server/tests/integration/test_worker_pipeline.py` | New threading tests (explicit + default) |
| `apps/web-app/app/deck-builder/page.tsx` | Simplify `enhancedPrompt`, send `deck_size` in the request body |

---

### Task 1: Parameterize `compose_deck`'s prompt templates by requested deck size

**Files:**
- Modify: `apps/api-server/app/services/llm/prompts.py`
- Modify: `apps/api-server/app/services/llm/base.py`
- Modify: `apps/api-server/tests/unit/test_llm_claude.py`
- Modify: `apps/api-server/tests/unit/test_llm_ollama.py`
- Modify: `apps/api-server/app/decks/pipeline.py` (the real `llm.compose_deck(...)` call site — this signature change breaks it immediately with a `TypeError` in production since it's called positionally via `run_in_executor`; patch it with a literal `60` as a stopgap, since `DeckGenerationPipeline` has no other source of deck size yet — Task 3 replaces this literal with `self.deck_size`)

- [ ] **Step 1: Write the failing test**

Append to `apps/api-server/tests/unit/test_llm_claude.py`:

```python
def test_compose_deck_uses_requested_deck_size():
    service, client = _service_with_reply('{"title": "Commander Deck", "cards": []}')
    service.compose_deck({"colors": ["R"]}, [{"name": "Sol Ring"}], "commander", 100)

    sent = client.messages.create.call_args.kwargs["messages"][0]["content"]
    system = client.messages.create.call_args.kwargs["system"]
    assert "100-card" in sent
    assert "equal 100" in sent
    assert "100-card" in system
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api-server && uv run pytest tests/unit/test_llm_claude.py::test_compose_deck_uses_requested_deck_size -v`
Expected: FAIL — `compose_deck()` currently takes only 3 args (`intent, cards, format`), so this raises `TypeError: compose_deck() takes 4 positional arguments but 5 were given`.

- [ ] **Step 3: Parameterize the prompt templates**

In `apps/api-server/app/services/llm/prompts.py`, replace:

```python
COMPOSE_DECK_SYSTEM = (
    "You are a Magic: The Gathering deck-building assistant. "
    "Build a valid 60-card deck from the provided candidate cards. "
    "Respond ONLY with valid JSON, no markdown fences."
)

COMPOSE_DECK_TEMPLATE = (
    "Build a 60-card {format} deck.\n\n"
    "Intent: {intent}\n\n"
    "Candidate cards:\n{cards}\n\n"
    "Return JSON with keys: title (string), cards (list of objects with name, quantity, section). "
    "Sections: creatures, spells, lands. Total quantity must equal 60."
)
```

with:

```python
COMPOSE_DECK_SYSTEM = (
    "You are a Magic: The Gathering deck-building assistant. "
    "Build a valid {deck_size}-card deck from the provided candidate cards. "
    "Respond ONLY with valid JSON, no markdown fences."
)

COMPOSE_DECK_TEMPLATE = (
    "Build a {deck_size}-card {format} deck.\n\n"
    "Intent: {intent}\n\n"
    "Candidate cards:\n{cards}\n\n"
    "Return JSON with keys: title (string), cards (list of objects with name, quantity, section). "
    "Sections: creatures, spells, lands. Total quantity must equal {deck_size}."
)
```

- [ ] **Step 4: Update `compose_deck`'s signature to format both templates**

In `apps/api-server/app/services/llm/base.py`, replace:

```python
    def compose_deck(self, intent: dict, cards: list[dict], format: str) -> dict:
        """Compose a 60-card deck from candidate cards and intent."""
        cards_text = "\n".join(f"- {c.get('name', 'Unknown')}" for c in cards)
        return self._complete_json(
            COMPOSE_DECK_SYSTEM,
            COMPOSE_DECK_TEMPLATE.format(format=format, intent=json.dumps(intent), cards=cards_text),
            max_tokens=2048,
        )
```

with:

```python
    def compose_deck(self, intent: dict, cards: list[dict], format: str, deck_size: int) -> dict:
        """Compose a deck of the requested size from candidate cards and intent."""
        cards_text = "\n".join(f"- {c.get('name', 'Unknown')}" for c in cards)
        return self._complete_json(
            COMPOSE_DECK_SYSTEM.format(deck_size=deck_size),
            COMPOSE_DECK_TEMPLATE.format(
                format=format, intent=json.dumps(intent), cards=cards_text, deck_size=deck_size
            ),
            max_tokens=2048,
        )
```

- [ ] **Step 5: Fix the two existing call sites this signature change breaks**

In `apps/api-server/tests/unit/test_llm_claude.py`, update:

```python
    result = service.compose_deck({"colors": ["R"]}, cards, "modern")
```

to:

```python
    result = service.compose_deck({"colors": ["R"]}, cards, "modern", 60)
```

In `apps/api-server/tests/unit/test_llm_ollama.py`, update:

```python
    result = _service().compose_deck({"colors": ["G"]}, [{"name": "Llanowar Elves"}], "standard")
```

to:

```python
    result = _service().compose_deck({"colors": ["G"]}, [{"name": "Llanowar Elves"}], "standard", 60)
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/api-server && uv run pytest tests/unit/test_llm_claude.py tests/unit/test_llm_ollama.py tests/unit/test_llm_base.py -v`
Expected: PASS (all tests in all three files — confirms the signature change didn't silently break `parse_intent`/`chat`/`chat_with_context` coverage in `test_llm_base.py`, which doesn't call `compose_deck` at all)

- [ ] **Step 7: Commit**

```bash
git add apps/api-server/app/services/llm/prompts.py apps/api-server/app/services/llm/base.py apps/api-server/tests/unit/test_llm_claude.py apps/api-server/tests/unit/test_llm_ollama.py
git commit -m "feat: parameterize compose_deck prompt by requested deck size"
```

---

### Task 2: `deck_size` DTO validation

**Files:**
- Modify: `apps/api-server/app/decks/dtos.py`
- Test: `apps/api-server/tests/unit/test_deck_routes_unit.py`

- [ ] **Step 1: Write the failing test**

Append to `apps/api-server/tests/unit/test_deck_routes_unit.py`:

```python
def test_generate_rejects_deck_size_below_60(client):
    res = client.post(
        "/api/v1/decks/generate",
        json={"prompt": "elf tribal", "deck_size": 40},
    )
    assert res.status_code == 422
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api-server && uv run pytest tests/unit/test_deck_routes_unit.py::test_generate_rejects_deck_size_below_60 -v`
Expected: FAIL — `deck_size` isn't a defined field yet, so Pydantic silently ignores it and the request proceeds past validation.

- [ ] **Step 3: Add the DTO field**

In `apps/api-server/app/decks/dtos.py`, add to `DeckGenerateRequestDTO`:

```python
class DeckGenerateRequestDTO(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    format: DeckFormat = DeckFormat.STANDARD
    colors: list[MTGColor] | None = None
    deck_size: int = Field(default=60, ge=60)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api-server && uv run pytest tests/unit/test_deck_routes_unit.py -v`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Commit**

```bash
git add apps/api-server/app/decks/dtos.py apps/api-server/tests/unit/test_deck_routes_unit.py
git commit -m "feat: validate deck size on generate request"
```

---

### Task 3: Thread `deck_size` from route through to the pipeline

**Files:**
- Modify: `apps/api-server/app/decks/routes.py`
- Modify: `apps/api-server/app/decks/worker.py`
- Modify: `apps/api-server/app/decks/pipeline.py`
- Test: `apps/api-server/tests/integration/test_deck_routes_db.py`
- Test: `apps/api-server/tests/integration/test_worker_pipeline.py`

- [ ] **Step 1: Write the failing test (route → broker forwarding)**

Append to `apps/api-server/tests/integration/test_deck_routes_db.py`:

```python
async def test_generate_forwards_deck_size_to_broker(client, session_factory, broker, fake_redis):
    res = await client.post(
        "/api/v1/decks/generate",
        json={"prompt": "commander deck", "format": "commander", "deck_size": 100},
        headers=AUTH,
    )
    assert res.status_code == 202
    body = res.json()

    broker.assert_called_once()
    assert broker.call_args.kwargs["args"] == [body["deck_id"], "commander deck", "commander", None, 100]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api-server && uv run pytest tests/integration/test_deck_routes_db.py::test_generate_forwards_deck_size_to_broker -v`
Expected: FAIL — `broker.call_args.kwargs["args"]` currently has only 4 elements (no deck_size).

- [ ] **Step 3: Forward deck_size in the route**

In `apps/api-server/app/decks/routes.py`, update the `apply_async` call:

```python
    try:
        generate_deck_task.apply_async(
            args=[
                str(deck.id),
                request.prompt,
                request.format,
                [c.value for c in request.colors] if request.colors else None,
                request.deck_size,
            ],
            task_id=task_id,
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api-server && uv run pytest tests/integration/test_deck_routes_db.py -v`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Commit**

```bash
git add apps/api-server/app/decks/routes.py apps/api-server/tests/integration/test_deck_routes_db.py
git commit -m "feat: forward deck size to the deck generation task"
```

- [ ] **Step 6: Write the failing tests (pipeline threading)**

Append to `apps/api-server/tests/integration/test_worker_pipeline.py`:

```python
@respx.mock
async def test_pipeline_passes_deck_size_to_compose_deck(session_factory, llm, fake_redis):
    _mock_scryfall()
    deck_id, task_id = await _seed(session_factory)

    await DeckGenerationPipeline(
        task_id=task_id, deck_id=deck_id, prompt="mono red burn", format="modern", deck_size=100,
    ).run()

    assert llm.compose_deck.call_args.args[-1] == 100


@respx.mock
async def test_pipeline_defaults_deck_size_to_60_when_omitted(session_factory, llm, fake_redis):
    _mock_scryfall()
    deck_id, task_id = await _seed(session_factory)

    await _run(task_id=task_id, deck_id=deck_id, prompt="mono red burn", format="modern").run()

    assert llm.compose_deck.call_args.args[-1] == 60
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd apps/api-server && uv run pytest tests/integration/test_worker_pipeline.py::test_pipeline_passes_deck_size_to_compose_deck -v`
Expected: FAIL — `TypeError: DeckGenerationPipeline.__init__() got an unexpected keyword argument 'deck_size'`

- [ ] **Step 8: Add `deck_size` to the pipeline constructor and pass it to `compose_deck`**

In `apps/api-server/app/decks/pipeline.py`, update `__init__`:

```python
    def __init__(
        self,
        task_id: str,
        deck_id: str,
        prompt: str,
        format: str,
        colors: list[str] | None = None,
        deck_size: int = 60,
    ):
        self.task_id = task_id
        self.deck_uuid = uuid.UUID(deck_id)
        self.prompt = prompt
        self.format = format
        self.explicit_colors = colors
        self.deck_size = deck_size
        self.channel = task_channel(task_id)
        self._session_factory: SessionFactory | None = None
```

And update the `compose_deck` call in `_generate()`:

```python
        deck_composition = await loop.run_in_executor(
            None, llm.compose_deck, intent, candidate_cards, self.format, self.deck_size
        )
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd apps/api-server && uv run pytest tests/integration/test_worker_pipeline.py -v`
Expected: PASS (all tests in the file — including `test_pipeline_success_completes_deck`, which passes no `deck_size` kwarg and must still work with the default)

- [ ] **Step 10: Wire the Celery task**

In `apps/api-server/app/decks/worker.py`:

```python
@celery_app.task(name="app.decks.worker.generate_deck_task", bind=True)
def generate_deck_task(
    self, deck_id: str, prompt: str, format: str, colors: list[str] | None = None, deck_size: int = 60
) -> dict:
    task_id: str = self.request.id
    pipeline = DeckGenerationPipeline(
        task_id=task_id, deck_id=deck_id, prompt=prompt, format=format, colors=colors, deck_size=deck_size,
    )
    asyncio.run(pipeline.run())
    return {"task_id": task_id, "deck_id": deck_id, "status": TaskStatus.COMPLETED}
```

No dedicated test for this step — same rationale as the colors plan: it's thin glue whose only observable behavior is exercised via the route test (Step 4) and the pipeline tests (Step 9).

- [ ] **Step 11: Run the full backend suite**

Run: `cd apps/api-server && uv run pytest -v`
Expected: PASS (no regressions elsewhere)

- [ ] **Step 12: Commit**

```bash
git add apps/api-server/app/decks/pipeline.py apps/api-server/app/decks/worker.py apps/api-server/tests/integration/test_worker_pipeline.py
git commit -m "feat: thread deck size through worker and pipeline"
```

---

### Task 4: Frontend — send `deck_size` structurally, retire dead prompt-folding code

**Files:**
- Modify: `apps/web-app/app/deck-builder/page.tsx`

This task is glue code only, same rationale as the colors plan's final task: no existing test scaffolding for `page.tsx`'s `fetch`/`EventSource`/router/context dependencies, and the change here has no independent logic to unit-test (it's a straight simplification plus one new field on an existing `JSON.stringify` call).

- [ ] **Step 1: Simplify `enhancedPrompt`, dropping the now-fully-dead `optParts` machinery**

In `apps/web-app/app/deck-builder/page.tsx`, `handleGenerateDeck` currently has:

```typescript
    const optParts = [
      deckSize !== 60 ? `Deck size: ${deckSize}` : '',
    ].filter(Boolean);
    const enhancedPrompt = prompt
      ? (optParts.length > 0 ? `${prompt}. ${optParts.join('. ')}` : prompt)
      : (optParts.length > 0 ? optParts.join('. ') : 'Surprise me with a fun deck');
```

Replace both lines with:

```typescript
    const enhancedPrompt = prompt || 'Surprise me with a fun deck';
```

- [ ] **Step 2: Send `deck_size` in the generate request body**

Replace:

```typescript
        body: JSON.stringify({
          prompt: enhancedPrompt,
          format: format.toLowerCase(),
          colors: toBackendColors(colors),
        }),
```

with:

```typescript
        body: JSON.stringify({
          prompt: enhancedPrompt,
          format: format.toLowerCase(),
          colors: toBackendColors(colors),
          deck_size: deckSize,
        }),
```

- [ ] **Step 3: Run the full frontend unit suite**

Run: `cd apps/web-app && npx vitest run`
Expected: PASS on all currently-passing files — `enums.test.ts`, `OptionsPanel.test.tsx`, `ManaSymbol.test.tsx` (no new regressions; `NavBar.test.tsx`'s 15 pre-existing failures are unrelated and unaffected)

- [ ] **Step 4: Manual browser verification**

Start the app (`make dev`) and, on the deck-builder page:
1. Generate a deck with the default size (60) — behaves as today.
2. Select Commander (deck size auto-sets to 100) and generate — confirm the result is a 100-card deck, not 60 (this is the bug this task fixes).
3. Manually bump the deck-size stepper to a non-default, non-Commander value (e.g. 80) and generate — confirm the resulting deck has that card count.

- [ ] **Step 5: Commit**

```bash
git add apps/web-app/app/deck-builder/page.tsx
git commit -m "feat: send deck size as structured field, retire dead prompt-folding code"
```

---

## Self-Review Notes

- **Spec coverage:** every design-doc section (parameterized templates, DTO validation, route/worker/pipeline threading, frontend structural send + optParts cleanup) maps to a task above. Out-of-scope items from the spec (no DB schema change, no upper bound, `handleChat`/`strategy` untouched) are respected — no task touches them.
- **Breaking-change awareness:** Task 1 explicitly fixes the two existing `compose_deck` call sites (`test_llm_claude.py`, `test_llm_ollama.py`) that the new required `deck_size` parameter would otherwise break — these aren't new tests, they're necessary updates to keep the suite green.
- **Type consistency:** `deck_size: int` is used consistently across `DeckGenerateRequestDTO`, `generate_deck_task`, `DeckGenerationPipeline.__init__`/`self.deck_size`, and `compose_deck`'s new 4th parameter. The frontend's `deckSize` (camelCase React state) maps to the backend's `deck_size` (snake_case JSON field) at the single point `JSON.stringify({..., deck_size: deckSize})`, matching the existing `task_id`/`deck_id` snake_case convention already used in `DeckGenerateResponseDTO`.
