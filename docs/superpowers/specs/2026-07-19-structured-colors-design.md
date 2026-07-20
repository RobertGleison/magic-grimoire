# Structured Colors on Deck Generation — Design

## Problem

The color swatches in `OptionsPanel` never reach `/decks/generate` as structured data. `handleGenerateDeck` (`apps/web-app/app/deck-builder/page.tsx:264-294`) string-interpolates the selection into the prompt (`"Colors: W, U"`) and relies on the backend's `parse_intent()` LLM step to re-derive `colors` from that prose. An explicit UI selection should be a guaranteed input, not something the LLM might mis-parse back out of a sentence. There's also no way to ask for a colorless deck — the color picker only offers W/U/B/R/G.

## Context

- `DeckGenerateRequestDTO` (`apps/api-server/app/decks/dtos.py:19-21`) currently has only `prompt` and `format`.
- `DeckGenerationPipeline._generate()` (`apps/api-server/app/decks/pipeline.py:66-93`) calls `llm.parse_intent(self.prompt)` to get an `intent` dict (`colors`, `creature_types`, `keywords`, `themes`, `format`, `strategy`), then uses `intent['colors']` for both `scryfall_service.search_cards()` and `llm.compose_deck()`, and finally saves `intent.get("colors", [])` onto the `Deck` row.
- `scryfall_service._build_scryfall_query` (`apps/api-server/app/services/scryfall_service.py:41-44`) turns `intent['colors']` into a `color<={codes}` Scryfall clause (e.g. `color<=WU`) only when the list is non-empty; empty means no color restriction.
- The frontend already has everything needed for a colorless option except wiring: `ManaColor.COLORLESS` and `COLOR_LABEL`/`COLOR_HEX` entries exist in `apps/web-app/app/enums.ts`, `ManaSymbol` (`apps/web-app/app/components/ManaSymbol/ManaSymbol.tsx`) already maps `"C"` → `mana-colorless.png`, and the asset file exists. Only `BASIC_COLORS` (what `ColorSelector` renders) and `COLOR_CODE` (what maps the UI's full names to backend letter codes) omit it.
- The `/api/v1/chat` endpoint already sends `colors` as a structured field in a `context` object (page.tsx:227-240) — this change brings `/decks/generate` in line with that existing pattern.

## Design

### Colorless as its own selectable swatch

Colorless is added as a 6th button in `ColorSelector`, mutually exclusive with W/U/B/R/G (a card identity can't be both colored and colorless):

- New `SELECTABLE_COLORS = [...BASIC_COLORS, ManaColor.COLORLESS]` in `enums.ts`, used by `ColorSelector` instead of `BASIC_COLORS` directly. `BASIC_COLORS` itself is untouched for other consumers.
- `toggleColor` (page.tsx:143) enforces exclusivity: selecting colorless clears any W/U/B/R/G selection; selecting a color clears colorless if it was selected.
- No selection at all (today's default) still means "no color restriction" — colorless is only ever the result of an explicit click, never an implicit default.

### Sending colors structurally

- `COLOR_CODE` (page.tsx:41) gains `COLORLESS: 'C'`.
- `handleGenerateDeck` drops colors from the `optParts` prompt-text interpolation and instead sends them as a field: `colors: colors.length > 0 ? colors.map(c => COLOR_CODE[c] ?? c) : undefined` in the `/api/v1/decks/generate` POST body.

### Backend: explicit colors override parse_intent

- New `MTGColor` StrEnum in `app/core/enums.py`: `WHITE="W"`, `BLUE="U"`, `BLACK="B"`, `RED="R"`, `GREEN="G"`, `COLORLESS="C"`.
- `DeckGenerateRequestDTO.colors: list[MTGColor] | None = None`.
- `routes.py` passes `colors` through `generate_deck_task.apply_async` (serialized to a plain `list[str]` or `None`, since Celery task args must be JSON-serializable).
- `generate_deck_task` (`decks/worker.py`) and `DeckGenerationPipeline.__init__` (`decks/pipeline.py`) each gain a `colors: list[str] | None = None` parameter, stored as `self.explicit_colors`.
- In `_generate()`, immediately after `intent = await loop.run_in_executor(None, llm.parse_intent, self.prompt)`:
  ```python
  if self.explicit_colors is not None:
      intent["colors"] = self.explicit_colors
  ```
  `None` (nothing sent, or an old client) means no override — `parse_intent`'s own guess from the prompt text still applies, preserving today's behavior for prompts like "mono red aggro deck" typed without touching the swatches.

### Scryfall colorless query

- `_build_scryfall_query` special-cases `colors == ["C"]`: emit `c:colorless` instead of the `color<=` clause, since `color<=C` is not valid Scryfall syntax for the colorless identity. All other non-empty color lists keep the existing `color<={codes}` behavior.

## Out of scope

- No change to `handleChat`'s existing structured `colors` context (it already works this way).
- No change to how `deckSize`/`strategy` are still folded into prompt text — this change is scoped to colors only.
- No DB schema change — `Deck.colors` is already a `list[str] | None` column, populated the same way (from `intent["colors"]` at save time), just now potentially overridden earlier in the pipeline.
- No validation error if a client sends both `"C"` and other colors in the same list — the query builder treats `colors == ["C"]` as the colorless case and anything else falls through to `color<={codes}`, so a malformed mixed list degenerates to the normal multicolor path rather than erroring. The frontend UI never produces this because of the mutual-exclusivity toggle.

## Testing plan

Manual verification in the browser:
1. Clicking the colorless swatch deselects any active W/U/B/R/G colors, and vice versa.
2. Generating a deck with colorless selected returns colorless-identity cards (artifacts, etc.), not an unrestricted mix.
3. Generating a deck with no colors selected behaves exactly as it does today (unrestricted color pool).
4. Generating a deck with W/U selected produces a deck restricted to those colors even if the typed prompt doesn't mention colors at all.
5. Typing "mono red deck" as the prompt with no swatches selected still produces a red deck (parse_intent fallback still works).

Backend: unit coverage for `_build_scryfall_query` (colorless case) and for the pipeline's override behavior (explicit colors present vs. `None`).
