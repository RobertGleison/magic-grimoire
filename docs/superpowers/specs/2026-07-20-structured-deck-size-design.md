# Structured Deck Size on Deck Generation — Design

## Problem

Like colors before this change, deck size never reaches `/decks/generate` as structured data. `handleGenerateDeck` (`apps/web-app/app/deck-builder/page.tsx`) only folds it into the prompt text (`"Deck size: 100"`) when it's not the default 60, and the backend has no `deck_size` concept anywhere — not in the DTO, not in the pipeline, not in `compose_deck`. Worse than the colors case: `services/llm/prompts.py`'s `COMPOSE_DECK_SYSTEM`/`COMPOSE_DECK_TEMPLATE` hardcode "60-card" and "Total quantity must equal 60" unconditionally. So selecting Commander format (which the frontend auto-sets to `deckSize=100`) sends the LLM two contradictory instructions in the same request: the hardcoded template says "build a 60-card deck" while the smuggled prompt text says "Deck size: 100".

## Context

- `DeckGenerateRequestDTO` (`apps/api-server/app/decks/dtos.py`) has no deck-size field.
- `DeckGenerationPipeline._generate()` (`apps/api-server/app/decks/pipeline.py`) calls `llm.compose_deck(intent, candidate_cards, self.format)` — `format` is passed straight through, unrelated to card count.
- `LLMService.compose_deck` (`apps/api-server/app/services/llm/base.py`) takes `(intent, cards, format)` and formats `COMPOSE_DECK_TEMPLATE` with `format`/`intent`/`cards` only — `COMPOSE_DECK_SYSTEM` is a plain constant string, not currently templated at all.
- Frontend already has a `deckSize` number state (`apps/web-app/app/deck-builder/page.tsx`), floored at 60 by the size-stepper UI (`Math.max(60, ...)`), with no upper bound, and auto-set to 100 when Commander format is selected.
- The colors change (previous plan) already stripped colors out of the prompt-text-folding (`optParts`); this change removes the only remaining entry, making that machinery permanently empty.

## Design

### Backend: parameterize the hardcoded deck size

- `app/services/llm/prompts.py`: `COMPOSE_DECK_SYSTEM` becomes a template (`"...Build a valid {deck_size}-card deck..."`), and `COMPOSE_DECK_TEMPLATE`'s two "60" references become `{deck_size}`.
- `app/services/llm/base.py`: `compose_deck(self, intent, cards, format, deck_size)` formats both `COMPOSE_DECK_SYSTEM` and `COMPOSE_DECK_TEMPLATE` with `deck_size`.
- `app/core/enums.py`: no new enum needed — deck size is a plain bounded int, not a closed set of values like colors.
- `app/decks/dtos.py`: `DeckGenerateRequestDTO.deck_size: int = Field(default=60, ge=60)`. `ge=60` matches the frontend's existing floor; no upper bound, consistent with there being no product-defined ceiling today.
- `app/decks/routes.py`: forward `request.deck_size` as a 5th positional arg on `generate_deck_task.apply_async` (after `colors`).
- `app/decks/worker.py` / `app/decks/pipeline.py`: `generate_deck_task` and `DeckGenerationPipeline.__init__` each gain `deck_size: int = 60`, stored as `self.deck_size`, passed into the `compose_deck` call in `_generate()`.

Unlike colors, there's no competing "LLM guess" to override — `parse_intent()` never produces a card count, so `deck_size` is simply a direct parameter threaded through to `compose_deck`, with a plain default of 60 when a client omits it.

### Frontend: send deck_size structurally, retire dead prompt-folding code

- `handleGenerateDeck` (`page.tsx`): the `optParts` array becomes permanently empty once its last entry (deck size) is removed — colors already emptied the other slot in the prior change. Simplify:
  ```typescript
  const enhancedPrompt = prompt || 'Surprise me with a fun deck';
  ```
  replacing the now-dead `optParts`/conditional-join machinery.
- Add `deck_size: deckSize` to the `/decks/generate` POST body, sent unconditionally (deck size is always a concrete number, never "unset" the way colors can be empty).

## Out of scope

- No DB schema change — `Deck.card_count` remains computed post-hoc from the actual generated cards, not the requested target size.
- No change to `handleChat`'s context payload or `strategy` handling.
- No upper-bound validation on `deck_size` (matches current product behavior — the frontend stepper has no ceiling either).

## Testing plan

Backend: unit/integration coverage for `compose_deck`'s templated deck size (both the system and user message contain the right number), and for the pipeline/route threading (mirroring the colors tests).

Manual verification in the browser:
1. Generating a deck with the default size (60) behaves as today.
2. Selecting Commander (deckSize auto-set to 100) produces a 100-card deck, resolving the previous contradictory-instructions bug.
3. Manually bumping deck size with the stepper and generating produces a deck of that size.
