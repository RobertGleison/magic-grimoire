# Structured Deck-Generation Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send the OptionsPanel's color selection to `/decks/generate` as a structured `colors` field (instead of folding it into the prompt text), add a colorless option, and make the explicit selection override whatever the LLM's `parse_intent()` guesses from the prompt.

**Architecture:** Backend: a new `MTGColor` enum validates the DTO field; it threads unchanged through the route → Celery task → `DeckGenerationPipeline`, which overrides `intent["colors"]` right after `parse_intent()` runs, before that intent is used for card search/composition/persistence. `scryfall_service` gets a colorless-specific Scryfall query branch. Frontend: colorless becomes a 6th, mutually-exclusive swatch in `ColorSelector`; two small pure helpers (`toggleDeckColor`, `toBackendColors`) in `enums.ts` carry the toggle and code-mapping logic so they're unit-testable without rendering the full page; `deck-builder/page.tsx` wires them in and stops string-interpolating colors into the prompt.

**Tech Stack:** FastAPI + Pydantic + Celery + pytest (backend, `uv run pytest`); Next.js/React + TypeScript + Vitest + Testing Library (frontend, `npm test`).

---

## File Map

| File | Change |
|---|---|
| `apps/api-server/app/core/enums.py` | Add `MTGColor` StrEnum |
| `apps/api-server/app/decks/dtos.py` | Add `colors: list[MTGColor] \| None` to `DeckGenerateRequestDTO` |
| `apps/api-server/app/decks/routes.py` | Forward `colors` into `apply_async` args |
| `apps/api-server/app/decks/worker.py` | Accept `colors` param, pass to pipeline |
| `apps/api-server/app/decks/pipeline.py` | Accept `colors`, override `intent["colors"]` after `parse_intent()` |
| `apps/api-server/app/services/scryfall_service.py` | Colorless-specific Scryfall query branch |
| `apps/api-server/tests/unit/test_deck_routes_unit.py` | New validation test |
| `apps/api-server/tests/integration/test_deck_routes_db.py` | New broker-forwarding test |
| `apps/api-server/tests/integration/test_worker_pipeline.py` | New override-behavior test |
| `apps/api-server/tests/unit/test_scryfall_service.py` | New colorless-query test |
| `apps/web-app/app/enums.ts` | Add `SELECTABLE_COLORS`, `toggleDeckColor`, `COLOR_CODE`, `toBackendColors` |
| `apps/web-app/app/components/OptionsPanel/OptionsPanel.tsx` | Render `SELECTABLE_COLORS` instead of `BASIC_COLORS` |
| `apps/web-app/app/deck-builder/page.tsx` | Use shared helpers; send `colors` in the generate request body instead of prompt text |
| `apps/web-app/tests/unit/enums.test.ts` | New — pure-helper tests |
| `apps/web-app/tests/unit/OptionsPanel.test.tsx` | New colorless-swatch tests |

---

### Task 1: `MTGColor` enum + DTO validation

**Files:**
- Modify: `apps/api-server/app/core/enums.py`
- Modify: `apps/api-server/app/decks/dtos.py`
- Test: `apps/api-server/tests/unit/test_deck_routes_unit.py`

- [ ] **Step 1: Write the failing test**

Append to `apps/api-server/tests/unit/test_deck_routes_unit.py`:

```python
def test_generate_rejects_invalid_color(client):
    res = client.post(
        "/api/v1/decks/generate",
        json={"prompt": "elf tribal", "colors": ["X"]},
    )
    assert res.status_code == 422
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api-server && uv run pytest tests/unit/test_deck_routes_unit.py::test_generate_rejects_invalid_color -v`
Expected: FAIL — `colors` isn't a defined field yet, so Pydantic silently ignores it and the request proceeds past validation (status will be 202 or 503 depending on broker reachability, not 422).

- [ ] **Step 3: Add the enum**

In `apps/api-server/app/core/enums.py`, add after `DeckFormat`:

```python
class MTGColor(StrEnum):
    WHITE     = "W"
    BLUE      = "U"
    BLACK     = "B"
    RED       = "R"
    GREEN     = "G"
    COLORLESS = "C"
```

- [ ] **Step 4: Add the DTO field**

In `apps/api-server/app/decks/dtos.py`, update the import and the request DTO:

```python
from app.core.enums import DeckFormat, DeckStatus, MTGColor
```

```python
class DeckGenerateRequestDTO(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    format: DeckFormat = DeckFormat.STANDARD
    colors: list[MTGColor] | None = None
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api-server && uv run pytest tests/unit/test_deck_routes_unit.py -v`
Expected: PASS (all tests in the file, including the new one)

- [ ] **Step 6: Commit**

```bash
git add apps/api-server/app/core/enums.py apps/api-server/app/decks/dtos.py apps/api-server/tests/unit/test_deck_routes_unit.py
git commit -m "feat: validate deck color codes on generate request"
```

---

### Task 2: Thread `colors` from route through to the pipeline, override `parse_intent`

**Files:**
- Modify: `apps/api-server/app/decks/routes.py`
- Modify: `apps/api-server/app/decks/worker.py`
- Modify: `apps/api-server/app/decks/pipeline.py`
- Test: `apps/api-server/tests/integration/test_deck_routes_db.py`
- Test: `apps/api-server/tests/integration/test_worker_pipeline.py`

- [ ] **Step 1: Write the failing test (route → broker forwarding)**

Append to `apps/api-server/tests/integration/test_deck_routes_db.py`:

```python
async def test_generate_forwards_colors_to_broker(client, session_factory, broker, fake_redis):
    res = await client.post(
        "/api/v1/decks/generate",
        json={"prompt": "azorius control", "format": "modern", "colors": ["W", "U"]},
        headers=AUTH,
    )
    assert res.status_code == 202
    body = res.json()

    broker.assert_called_once()
    assert broker.call_args.kwargs["args"] == [body["deck_id"], "azorius control", "modern", ["W", "U"]]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api-server && uv run pytest tests/integration/test_deck_routes_db.py::test_generate_forwards_colors_to_broker -v`
Expected: FAIL — `broker.call_args.kwargs["args"]` currently has only 3 elements (no colors).

- [ ] **Step 3: Forward colors in the route**

In `apps/api-server/app/decks/routes.py`, update the `apply_async` call:

```python
    try:
        generate_deck_task.apply_async(
            args=[
                str(deck.id),
                request.prompt,
                request.format,
                [c.value for c in request.colors] if request.colors else None,
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
git commit -m "feat: forward explicit colors to the deck generation task"
```

- [ ] **Step 6: Write the failing test (pipeline override behavior)**

Append to `apps/api-server/tests/integration/test_worker_pipeline.py`:

```python
@respx.mock
async def test_pipeline_explicit_colors_override_parse_intent(session_factory, llm, fake_redis):
    _mock_scryfall()
    deck_id, task_id = await _seed(session_factory)

    await DeckGenerationPipeline(
        task_id=task_id, deck_id=deck_id, prompt="mono red burn", format="modern", colors=["W", "U"],
    ).run()

    async with session_factory() as db:
        deck = (await db.execute(select(Deck).where(Deck.id == uuid.UUID(deck_id)))).scalar_one()

    assert deck.colors == ["W", "U"]
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd apps/api-server && uv run pytest tests/integration/test_worker_pipeline.py::test_pipeline_explicit_colors_override_parse_intent -v`
Expected: FAIL — `TypeError: __init__() got an unexpected keyword argument 'colors'`

- [ ] **Step 8: Add `colors` to the pipeline constructor and override `intent["colors"]`**

In `apps/api-server/app/decks/pipeline.py`, update `__init__`:

```python
    def __init__(self, task_id: str, deck_id: str, prompt: str, format: str, colors: list[str] | None = None):
        self.task_id = task_id
        self.deck_uuid = uuid.UUID(deck_id)
        self.prompt = prompt
        self.format = format
        self.explicit_colors = colors
        self.channel = task_channel(task_id)
        self._session_factory: SessionFactory | None = None
```

And in `_generate()`, right after the off-topic check:

```python
        # Belt-and-suspenders: LLM may flag off_topic even if the rule filter passed.
        if intent.get("error") == "off_topic":
            raise ValueError(intent.get("message", "I only discuss Magic: The Gathering."))

        # Explicit user selection always wins over the LLM's guess from the prompt text.
        if self.explicit_colors is not None:
            intent["colors"] = self.explicit_colors
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd apps/api-server && uv run pytest tests/integration/test_worker_pipeline.py -v`
Expected: PASS (all tests in the file — including `test_pipeline_success_completes_deck`, which passes no `colors` kwarg and must still resolve `deck.colors == ["R"]` from `parse_intent`, proving the `None`-means-no-override fallback still works)

- [ ] **Step 10: Wire the Celery task**

In `apps/api-server/app/decks/worker.py`:

```python
@celery_app.task(name="app.decks.worker.generate_deck_task", bind=True)
def generate_deck_task(self, deck_id: str, prompt: str, format: str, colors: list[str] | None = None) -> dict:
    task_id: str = self.request.id
    pipeline = DeckGenerationPipeline(
        task_id=task_id, deck_id=deck_id, prompt=prompt, format=format, colors=colors,
    )
    asyncio.run(pipeline.run())
    return {"task_id": task_id, "deck_id": deck_id, "status": TaskStatus.COMPLETED}
```

No dedicated test for this step — it's a 2-line glue function whose only externally observable behavior (the args Celery receives, and the pipeline's resulting behavior) is already covered by Step 4's route test and Step 9's pipeline tests, matching how this function was left untested before this change too.

- [ ] **Step 11: Run the full backend suite**

Run: `cd apps/api-server && uv run pytest -v`
Expected: PASS (no regressions elsewhere)

- [ ] **Step 12: Commit**

```bash
git add apps/api-server/app/decks/pipeline.py apps/api-server/app/decks/worker.py apps/api-server/tests/integration/test_worker_pipeline.py
git commit -m "feat: override parsed intent colors with explicit user selection"
```

---

### Task 3: Colorless Scryfall query

**Files:**
- Modify: `apps/api-server/app/services/scryfall_service.py`
- Test: `apps/api-server/tests/unit/test_scryfall_service.py`

- [ ] **Step 1: Write the failing test**

Append to `apps/api-server/tests/unit/test_scryfall_service.py`, in the `_build_scryfall_query` section:

```python
def test_query_colorless_uses_c_colorless():
    assert _build_scryfall_query({"colors": ["C"]}) == "c:colorless"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api-server && uv run pytest tests/unit/test_scryfall_service.py::test_query_colorless_uses_c_colorless -v`
Expected: FAIL — current output is `"color<=C"`, which isn't valid Scryfall colorless syntax.

- [ ] **Step 3: Implement the colorless branch**

In `apps/api-server/app/services/scryfall_service.py`, update `_build_scryfall_query`:

```python
    colors: list[str] = intent.get("colors", [])
    if colors == ["C"]:
        parts.append("c:colorless")
    elif colors:
        color_str = "".join(colors)
        parts.append(f"color<={color_str}")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api-server && uv run pytest tests/unit/test_scryfall_service.py -v`
Expected: PASS (all tests in the file — confirms the existing multicolor queries, e.g. `color<=RG`, are unaffected)

- [ ] **Step 5: Commit**

```bash
git add apps/api-server/app/services/scryfall_service.py apps/api-server/tests/unit/test_scryfall_service.py
git commit -m "feat: search colorless-identity cards via c:colorless"
```

---

### Task 4: Frontend pure helpers — colorless toggle exclusivity + shared color-code mapping

**Files:**
- Modify: `apps/web-app/app/enums.ts`
- Test: `apps/web-app/tests/unit/enums.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `apps/web-app/tests/unit/enums.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { SELECTABLE_COLORS, ManaColor, toggleDeckColor, COLOR_CODE, toBackendColors } from '../../app/enums';

describe('SELECTABLE_COLORS', () => {
  it('includes colorless after the five basic colors', () => {
    expect(SELECTABLE_COLORS).toEqual([
      ManaColor.WHITE, ManaColor.BLUE, ManaColor.BLACK, ManaColor.RED, ManaColor.GREEN, ManaColor.COLORLESS,
    ]);
  });
});

describe('toggleDeckColor', () => {
  it('adds a color that is not selected', () => {
    expect(toggleDeckColor([], ManaColor.WHITE)).toEqual([ManaColor.WHITE]);
  });

  it('removes a color that is already selected', () => {
    expect(toggleDeckColor([ManaColor.WHITE], ManaColor.WHITE)).toEqual([]);
  });

  it('selecting colorless clears any basic colors', () => {
    expect(toggleDeckColor([ManaColor.WHITE, ManaColor.BLUE], ManaColor.COLORLESS)).toEqual([ManaColor.COLORLESS]);
  });

  it('selecting a basic color clears colorless', () => {
    expect(toggleDeckColor([ManaColor.COLORLESS], ManaColor.RED)).toEqual([ManaColor.RED]);
  });
});

describe('toBackendColors', () => {
  it('returns undefined when nothing is selected', () => {
    expect(toBackendColors([])).toBeUndefined();
  });

  it('maps full color names to backend letter codes', () => {
    expect(toBackendColors([ManaColor.WHITE, ManaColor.BLUE])).toEqual(['W', 'U']);
  });

  it('maps colorless to C', () => {
    expect(toBackendColors([ManaColor.COLORLESS])).toEqual(['C']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web-app && npx vitest run tests/unit/enums.test.ts`
Expected: FAIL — `SELECTABLE_COLORS`, `toggleDeckColor`, `COLOR_CODE`, `toBackendColors` don't exist yet (import/undefined errors).

- [ ] **Step 3: Implement the helpers**

In `apps/web-app/app/enums.ts`, add after the `COLOR_HEX` block:

```typescript
export const SELECTABLE_COLORS = [...BASIC_COLORS, ManaColor.COLORLESS] as const;

// A card identity can't be both colored and colorless, so picking one clears the other.
export function toggleDeckColor(current: string[], color: string): string[] {
  if (current.includes(color)) {
    return current.filter(c => c !== color);
  }
  if (color === ManaColor.COLORLESS) {
    return [ManaColor.COLORLESS];
  }
  return [...current.filter(c => c !== ManaColor.COLORLESS), color];
}

// Maps frontend ManaColor names to the single-letter codes the backend expects.
export const COLOR_CODE: Record<string, string> = {
  WHITE: 'W', BLUE: 'U', BLACK: 'B', RED: 'R', GREEN: 'G', COLORLESS: 'C',
};

export function toBackendColors(colors: string[]): string[] | undefined {
  return colors.length > 0 ? colors.map(c => COLOR_CODE[c] ?? c) : undefined;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web-app && npx vitest run tests/unit/enums.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web-app/app/enums.ts apps/web-app/tests/unit/enums.test.ts
git commit -m "feat: add colorless option and shared color-code helpers"
```

---

### Task 5: Render the colorless swatch in `ColorSelector`

**Files:**
- Modify: `apps/web-app/app/components/OptionsPanel/OptionsPanel.tsx`
- Test: `apps/web-app/tests/unit/OptionsPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `apps/web-app/tests/unit/OptionsPanel.test.tsx`:

```typescript
describe('OptionsPanel — colors', () => {
  it('renders a colorless swatch', () => {
    render(<OptionsPanel {...baseProps()} />);
    expect(screen.getByTitle('Colorless')).toBeInTheDocument();
  });

  it('calls toggleColor with COLORLESS when clicked', () => {
    const toggleColor = vi.fn();
    render(<OptionsPanel {...baseProps({ toggleColor })} />);
    fireEvent.click(screen.getByTitle('Colorless'));
    expect(toggleColor).toHaveBeenCalledWith('COLORLESS');
  });
});
```

(Uses `getByTitle` rather than `getByRole('button', { name: ... })` — the button's accessible name would otherwise resolve from the `<ManaSymbol>` image's `alt` text, not the `title` attribute.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web-app && npx vitest run tests/unit/OptionsPanel.test.tsx`
Expected: FAIL — no element with `title="Colorless"` exists yet (`ColorSelector` only renders `BASIC_COLORS`).

- [ ] **Step 3: Render `SELECTABLE_COLORS` instead of `BASIC_COLORS`**

In `apps/web-app/app/components/OptionsPanel/OptionsPanel.tsx`, update the import and the map call:

```typescript
import { ALL_FORMATS, SELECTABLE_COLORS, COLOR_LABEL } from '../../enums';
```

```typescript
function ColorSelector({ colors, toggleColor }: {
  colors: string[];
  toggleColor: (color: string) => void;
}) {
  return (
    <OptionsSection label="Colors">
      <div className="options-panel-color-row">
        {SELECTABLE_COLORS.map(c => (
          <button
            key={c}
            className={`options-panel-color-btn${colors.includes(c) ? ' options-panel-color-btn-on' : ''}`}
            onClick={() => toggleColor(c)}
            title={COLOR_LABEL[c]}
          >
            <ManaSymbol symbol={c} size={30} />
          </button>
        ))}
      </div>
      {colors.length > 0 && (
        <button className="opt-btn options-panel-clear-btn" onClick={() => colors.forEach(c => toggleColor(c))}>
          clear selection
        </button>
      )}
    </OptionsSection>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web-app && npx vitest run tests/unit/OptionsPanel.test.tsx`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Commit**

```bash
git add apps/web-app/app/components/OptionsPanel/OptionsPanel.tsx apps/web-app/tests/unit/OptionsPanel.test.tsx
git commit -m "feat: render colorless swatch in the color selector"
```

---

### Task 6: Wire `deck-builder/page.tsx` — shared helpers, structured colors on generate

**Files:**
- Modify: `apps/web-app/app/deck-builder/page.tsx`

This task is glue code only: it wires the pure helpers built and unit-tested in Task 4 into the page component. There is no existing test file for `deck-builder/page.tsx` (it's a 469-line component with `fetch`/`EventSource`/router/context dependencies that aren't mocked anywhere in this codebase yet), and building that scaffolding just to assert a request-body shape already covered by `toBackendColors`'s unit tests would be scope creep beyond this change. Verification here is regression tests on the modules already covered, plus the manual browser check from the spec's testing plan.

- [ ] **Step 1: Replace the local `COLOR_CODE` constant with the shared import**

In `apps/web-app/app/deck-builder/page.tsx`, remove the local constant (lines 40-43):

```typescript
// Maps frontend ManaColor names to single-letter codes the backend expects.
const COLOR_CODE: Record<string, string> = {
  WHITE: 'W', BLUE: 'U', BLACK: 'B', RED: 'R', GREEN: 'G',
};
```

and add `toBackendColors` and `toggleDeckColor` to the existing import from `'../enums'` (add the import line if one doesn't already exist near the other component imports at the top of the file).

- [ ] **Step 2: Update `toggleColor` to delegate to the shared helper**

Replace:

```typescript
  const toggleColor = (color: string) => {
    setColors(prev => prev.includes(color) ? prev.filter(selected => selected !== color) : [...prev, color]);
  };
```

with:

```typescript
  const toggleColor = (color: string) => {
    setColors(prev => toggleDeckColor(prev, color));
  };
```

- [ ] **Step 3: Reuse `toBackendColors` in `handleChat`**

Replace the inline mapping in the `/api/v1/chat` body (around line 237):

```typescript
            colors: colors.length > 0 ? colors.map(c => COLOR_CODE[c] ?? c) : undefined,
```

with:

```typescript
            colors: toBackendColors(colors),
```

- [ ] **Step 4: Send colors structurally in `handleGenerateDeck`, stop folding them into the prompt**

Replace:

```typescript
    const optParts = [
      colors.length > 0 ? `Colors: ${colors.join(', ')}` : '',
      deckSize !== 60 ? `Deck size: ${deckSize}` : '',
    ].filter(Boolean);
```

with:

```typescript
    const optParts = [
      deckSize !== 60 ? `Deck size: ${deckSize}` : '',
    ].filter(Boolean);
```

and replace the fetch body:

```typescript
        body: JSON.stringify({ prompt: enhancedPrompt, format: format.toLowerCase() }),
```

with:

```typescript
        body: JSON.stringify({
          prompt: enhancedPrompt,
          format: format.toLowerCase(),
          colors: toBackendColors(colors),
        }),
```

- [ ] **Step 5: Run the full frontend unit suite**

Run: `cd apps/web-app && npx vitest run`
Expected: PASS (no regressions in `enums.test.ts`, `OptionsPanel.test.tsx`, `ManaSymbol.test.tsx`, `AuthModal.test.tsx`, `NavBar.test.tsx`)

- [ ] **Step 6: Manual browser verification**

Start the app (`make dev`) and, on the deck-builder page:
1. Click the colorless swatch — confirm any active W/U/B/R/G buttons deselect.
2. Click a W/U/B/R/G swatch while colorless is selected — confirm colorless deselects.
3. Generate a deck with colorless selected — confirm the result is colorless-identity cards (artifacts etc.), not an unrestricted mix.
4. Generate a deck with no colors selected — confirm behavior is unchanged from before this change (unrestricted color pool).
5. Generate a deck with W/U selected and a prompt that doesn't mention colors — confirm the deck is restricted to W/U.
6. Generate a deck with no swatches selected, typing "mono red deck" as the prompt — confirm it still produces a red deck (parse_intent fallback intact).

- [ ] **Step 7: Commit**

```bash
git add apps/web-app/app/deck-builder/page.tsx
git commit -m "feat: send deck colors as structured field instead of prompt text"
```

---

## Self-Review Notes

- **Spec coverage:** every design-doc section (colorless swatch + exclusivity, structured send, DTO/enum, pipeline override, Scryfall colorless query) maps to a task above. The "out of scope" items from the spec (chat context already structured, deckSize/strategy left as prose, no DB schema change, no validation error for malformed mixed lists) are untouched, matching the spec.
- **Type consistency:** `colors: list[str] | None` is used consistently across `DeckGenerateRequestDTO` (as `list[MTGColor] | None`, serialized to `list[str] | None` at the route boundary), `generate_deck_task`, and `DeckGenerationPipeline.__init__`/`self.explicit_colors`. Frontend `ManaColor` values (`WHITE`, `COLORLESS`, ...) are consistently distinguished from backend letter codes (`W`, `C`, ...) — `COLOR_CODE`/`toBackendColors` is the single conversion point, used in both `handleChat` and `handleGenerateDeck`.
