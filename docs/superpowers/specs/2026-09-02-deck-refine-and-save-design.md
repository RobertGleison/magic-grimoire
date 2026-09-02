# Targeted Card Refinement and Explicit Deck Saving — Design

## Problem

Two gaps in the deck-builder workflow.

**A deck can only be rerolled, never adjusted.** Once a deck is on screen there is no
card-level operation anywhere in the stack. The only way to change one card is to press
Generate again, which reruns `parse_intent → search_cards → compose_deck → enrich` and
rerolls all 60 cards. A player who likes 58 of them has no move.

**Nothing is ever saved deliberately, and everything is saved accidentally.**
`POST /decks/generate` stamps `user_id` on the row at creation time
(`apps/api-server/app/decks/routes.py:41`, via `get_optional_user`), and `apiClient`
attaches the Supabase bearer to every request automatically. So every forge by a signed-in
user is already in `/library` the instant it is enqueued — including `pending` rows and
`failed` ones, because `GET /decks` applies no status filter
(`routes.py:104-110`). Meanwhile a deck forged while signed out gets `user_id = null` and
there is no endpoint that can ever adopt it. The deck-builder screen has no save affordance
at all.

The two are one feature: a deck you can adjust is a deck that has versions, and a version
is what a save persists.

## Context

- `Deck` (`apps/api-server/app/decks/model.py`) is a single mutable row: `title`, `prompt`,
  `user_id`, `format`, `colors`, `cards` (JSONB), `card_count`, `status`, `error_message`,
  and three timestamps. No versioning, no ownership beyond the nullable `user_id`.
- One migration exists: `alembic/versions/001_initial_schema.py`.
- `DeckGenerationPipeline` (`app/decks/pipeline.py`, 151 lines) owns the whole generation
  sequence and publishes six `TaskProgress` values to Redis Pub/Sub, streamed to the client
  at `GET /tasks/{id}/stream`.
- `LLMService` (`app/llm/base.py`) is a deep interface: it owns prompt formatting, JSON
  parsing, retries and error normalisation, and adapters implement only `_complete()`. A new
  deck operation belongs here, not in a provider.
- `GET /decks/{id}` allows access when `user_id` is null or matches the caller; anonymous
  decks are readable by anyone holding the id. `?deck=<uuid>` in the builder is the
  permalink that relies on this.
- Deck grid tiles and list rows in `DeckResultsPanel` already carry `hoverProps` from
  `useCardHoverPreview`, whose bindings are only `onMouseEnter`/`onMouseLeave` — click is
  free.
- The grid renders **one tile per physical copy** (four Bolts are four tiles); the list
  renders one aggregated row per entry with a `×4` quantity.
- `resolveNextPath` (`app/login/authShared.ts`) is the open-redirect chokepoint for the auth
  surface. It rejects anything not starting with a single `/`, but **preserves query
  strings**, so a login round-trip can carry a deck id.

## Design

### 1. Data model

Migration `002` adds three columns to `decks`:

| column | type | meaning |
|---|---|---|
| `saved_at` | `TIMESTAMPTZ NULL` | set ⇒ immutable saved snapshot; null ⇒ mutable working draft |
| `lineage_id` | `UUID NOT NULL` | groups a draft with every snapshot taken from it |
| `version_no` | `INTEGER NULL` | 1-based within a lineage; null on drafts |

Plus an index on `(user_id, saved_at DESC)` for the library query, and a unique constraint on
`(lineage_id, version_no)` so two concurrent saves cannot mint the same version number.

Existing rows are backfilled `saved_at = created_at`, `version_no = 1`, `lineage_id = id`,
so no deck already visible in a library disappears.

`Deck` therefore carries two distinct kinds of row. A **draft** (`saved_at IS NULL`) is the
mutable working document: the forge writes it, each refine overwrites it, and it is invisible
to the library. A **snapshot** (`saved_at IS NOT NULL`) is an immutable saved version.

Lifecycle:

```
forge            -> draft D          saved_at NULL, lineage=D, version NULL
refine (2 cards) -> draft D          overwritten in place
Save             -> INSERT V1        copy of D, saved_at=now, v1, lineage=D
refine           -> draft D          overwritten again
Save             -> INSERT V2        v2, lineage=D

open V1 from library, then refine
                 -> INSERT draft D2  copy of V1, lineage=D   (V1 untouched)
Save             -> INSERT V3        v3, lineage=D
```

Two invariants make this hold:

1. **A refine never writes to a row with `saved_at` set.** It forks a fresh draft from the
   snapshot and returns the new `deck_id`. A version you chose to keep cannot change
   under you.
2. **`GET /decks` filters `WHERE saved_at IS NOT NULL`**, ordered by `saved_at DESC`. The
   library is exactly your saves; drafts never appear.

Saved snapshots are `Deck` rows rather than a separate `deck_versions` table specifically so
the library grid, its search and sort, `DELETE /decks/{id}`, `DeckSummaryCard` and the
`?deck=` permalink all keep working against the type they already use.

### 2. Save endpoint

`POST /decks/{deck_id}/save` → `200 DeckResponseDTO` (the new snapshot).

- Requires auth (`get_current_user`).
- Readability guard matching `get_deck`: the source deck's `user_id` must be null or the
  caller's; otherwise 403. 404 when the deck does not exist.
- 400 unless the source deck is `completed` with a non-empty card list. A deck mid-generation
  is `processing`, so this also rejects saving a deck that is still being built.
- 400 when the source row already has `saved_at` set. Re-saving a snapshot would write a
  byte-identical duplicate version; the meaningful action on a snapshot is to refine it,
  which forks a draft, and that draft is what gets saved next.
- Inserts a snapshot copying `title`, `prompt`, `format`, `colors`, `cards`, `card_count`,
  `status`, with `user_id` = caller, `saved_at = now()`, `lineage_id` = source's
  `lineage_id`, and `version_no = max(version_no) + 1` over that lineage (1 when none).

`version_no` is computed from a read, so two concurrent saves of the same draft could pick
the same number. Migration `002` therefore adds a unique constraint on
`(lineage_id, version_no)`, and the route retries once on its violation before surfacing a
503 — the same shape as the existing `SQLAlchemyError` handling in the generate route.

This is also the operation that adopts a deck forged while signed out: the snapshot is
written with the caller's `user_id` regardless of the source row's null one.

`version_no` is added to `DeckResponseDTO` and to the frontend `DeckResponse` type.

### 3. Refine endpoint

`POST /decks/{deck_id}/refine` → `202 { task_id, deck_id, status }` — deliberately the same
envelope `generate` returns, so the frontend needs no new streaming concepts.

```jsonc
{
  "replace": [ {"name": "Lightning Bolt", "quantity": 2},
               {"name": "Shock", "quantity": 1} ],
  "instruction": "cheaper, and give me some reach"
}
```

`get_optional_user`, matching `generate` and `get_deck` — the builder works signed out.

Validation, all 400:

- the deck must be `completed` with a non-empty card list;
- `replace` must be non-empty, and every name must exist in the deck's current cards with at
  least the requested quantity;
- `instruction` is 1–500 chars and passes through `sanitize_prompt`, the same guard the
  generate route applies.

`deck_id` in the response is the row that will actually be written: the same deck when the
target was a draft, a freshly forked draft when the target was a snapshot. The frontend must
read it back rather than assume it.

Creates a `Task` row (`queued`) against the target deck, commits, then enqueues
`refine_deck_task` — the same commit-before-`apply_async` ordering the generate route uses to
avoid the worker racing the transaction.

### 4. Refine pipeline

`pipeline.py` is already 151 lines and a second pipeline class would push it past 300, so the
shared task plumbing (`_publish`, `_mark_processing`, the per-invocation
`DatabaseSessionManager`, and the `_fetch_deck_and_task` read) is extracted into a small
`_TaskPipeline` base in `pipeline.py`. `DeckGenerationPipeline` stays there;
`DeckRefinementPipeline` goes in a new `app/decks/refinement.py`. New Celery task
`refine_deck_task` in `worker.py`.

Failure handling is **not** shared. `mark_generation_failed` sets
`deck.status = FAILED`, which is right for a generation — there is no deck yet — and wrong
for a refinement, which fails with a perfectly good deck still in the row. `_TaskPipeline`
declares an abstract `_mark_failed(deck, task, error)`; the generation pipeline delegates to
the existing `mark_generation_failed`, and the refinement pipeline records the failure on the
`Task` and in `deck.error_message` only, leaving `deck.status` at `completed` and the cards
untouched.

The refinement reuses all six existing `TaskProgress` values, so `useTaskStream` and
`GenerationProgress` are untouched:

| phase | work |
|---|---|
| `processing` | load the deck, split `cards` into locked and the N slots being replaced |
| `searching_cards` | `parse_intent(instruction)`, merged with the deck's format and colors → `scryfall_service.search_cards` (Redis-cached as usual) |
| `composing_deck` | `llm.refine_deck(...)` → exactly N slots' worth of cards |
| `enriching` | `enrich_cards` on **only the new names**; locked cards already carry `image_uri`, `mana_cost` and `type_line` |
| `completed` | merge locked + new, recompute `card_count`, write the row |

Enriching only the new names is what makes a refine substantially cheaper than a forge.

`deck.colors` is left untouched. It records the brief, not the contents, and the colour ring
in the UI derives from the cards' own mana costs (`deckColorDistribution`).

### 5. Refine prompt

`REFINE_DECK_SYSTEM` and `REFINE_DECK_TEMPLATE` in `app/llm/prompts.py`, with `refine_deck()`
added to `LLMService` so both Claude and Ollama get it without touching either adapter.

The template receives the locked list as `name | mana cost | type line` (so the model can see
what the deck actually does), the cards being removed, the instruction, the candidate pool,
the format, and the slot count. Two constraints the compose prompt never had to express:

- the 4-copy cap is counted **including locked copies** — two locked Bolts means at most two
  more may be added;
- in Commander, a replacement may not name a locked card at all, since the deck is singleton.

Replaced lands should come back as lands unless the instruction says otherwise, so a refine
cannot silently wreck the mana base. Output shape matches `compose_deck`'s
(`{"cards": [{"name", "quantity", "section"}]}`), minus the title — a refine never renames
the deck.

### 6. Deterministic reconciliation

Deck size is the property a user notices breaking, so the pipeline does not trust the model's
arithmetic. Before the write, `_reconcile(replacements, slots, locked)`:

- trims from the end when the returned quantities overshoot `slots`;
- pads with the basic land already most-played in the deck when they undershoot;
- clamps any name that would exceed its copy limit once locked copies are counted (1 in
  Commander, 4 elsewhere, unlimited for basics), redistributing the freed slots through the
  same two rules.

The result is that `card_count` is invariant across a refine by construction, not by the
model's cooperation.

### 7. Selection UI

New pure module `deck-builder/selection.ts`, no React and no DOM:

- selection is a `ReadonlySet<string>` of `` `${name}#${copyIndex}` `` keys;
- `toggleCopy`, `setCardCount` (takes the first N copy keys, for the list stepper),
  `countsByCard`, `slotCount`, `toReplaceRequest()` collapsing the set into the
  `[{name, quantity}]` the endpoint wants.

Copies are physically identical, so the keys exist only to drive which *tiles* light up; the
wire format is a multiset.

`DeckResultsPanel` takes `selection` plus `onToggleCopy`, `onSetCardCount` and
`onClearSelection`:

- **Grid** — each `<li>` wraps its art in a `<button type="button" aria-pressed>` carrying
  the hover bindings, so hover still previews while click toggles. Selected copies get a gold
  ring and a corner check.
- **List** — the row toggles all-or-none and gains a `− n +` stepper, so "2 of the 4 Bolts"
  stays expressible in a view that shows one aggregated row.
- Both are inert while a forge or refine is in flight. Selection resets when `deck.id`
  changes and when a refine completes.

`deck-builder/RefineTray.tsx` docks at the bottom of the deck column, absent at zero
selection and sliding up when something is selected: the selected cards as removable chips, a
count ("2 cards · 3 slots"), an auto-growing instruction textarea whose Enter/Shift+Enter
handling mirrors `ChatPanel`'s, `Refine N cards`, and `Clear`.

### 8. Page wiring

`refineDeck()` and `saveDeck()` are added to `apiClient`; `RefineRequest` and
`RefineResponse` to `types/api`. `page.tsx` gains a fourth `AbortController` ref alongside
the existing three, so a refine and a chat turn can never abort one another.

`handleRefine` POSTs, then sets `deckId` and `taskId` **from the response**. That single
detail is what makes the fork-on-snapshot case work with no extra frontend logic: the
existing `stream.phase === 'completed'` effect then reads back whichever row the backend
actually wrote. The request and its outcome are pushed into the chat transcript
("Refining 2 cards: cheaper, and give me some reach"), keeping the conversation a readable
record of how the deck reached its current state.

### 9. Save UI

A primary-weight `Save to Library` in the deck header's action row, beside Copy List /
Export TXT / Copy Link, enabled only on a `completed` deck.

- **Signed in** → `saveDeck(deck.id)`, and the existing `actionNote` reports
  "Saved to your library as v2."
- **Signed out** → `router.push` to `/login?next=` +
  `encodeURIComponent(resolveNextPath('/deck-builder?deck=<id>&save=1'))`. On return the page
  sees `save=1` and saves once — gated on `useUser().status === 'signed-in'`, since the
  parameter is read on first paint while the session is still `checking` and a save fired
  then would 401. The parameter is stripped with `history.replaceState` before the request so
  a reload cannot save twice, and a ref guards against the effect re-running.

This needs `useUser()` in the page, already available from the `UserProvider` in the root
layout.

### 10. Library

One change: `DeckSummaryCard` prints the `version_no` it now receives — "v3 · 2 hours ago" in
the metadata row. Search, sort, format filtering, delete and the grid are untouched, and the
grid now shows one card per saved version, newest first.

## Error handling

- **Refine validation** — 400 with a `detail` string, surfaced by `ApiError` into the tray as
  inline text rather than replacing the deck panel, since the deck on screen is still valid.
- **Refine failure mid-run** — `mark_generation_failed` already sets `status`/`error_message`
  on the deck and task, and publishes `failed`. But a failed refine must not leave the deck
  showing `failed` when its card list is intact, so the refinement pipeline records the
  failure on the `Task` and in `error_message` while leaving `deck.status` at `completed` and
  the existing cards in place. The page's `stream.phase === 'failed'` branch shows the reason
  with the previous deck still rendered.
- **Save on an unowned deck** — 403; the note reports that the deck belongs to someone else.
- **Save while signed out with a stale session** — `saveDeck` throws 401; the page falls back
  to the login round-trip rather than showing an error.
- **Reconciliation** — never raises. It always produces exactly `slots` cards, so a
  misbehaving model degrades to extra basic lands rather than a wrong-sized deck.

## Testing

Backend (`apps/api-server/tests/`, matching the existing unit/integration split):

- `unit/test_deck_routes_unit.py` — refine request DTO validation: empty `replace`, quantity
  above what the deck holds, unknown card name, instruction length bounds, injection-flagged
  instruction.
- `integration/test_deck_routes_db.py` — save creates a snapshot with the right `version_no`
  and `lineage_id`; a second save increments it; save adopts an anonymous deck; save is 403
  on someone else's deck and 400 on a row already saved; `GET /decks` excludes drafts and
  includes snapshots newest-first; refine on a snapshot returns a different `deck_id` and
  leaves the snapshot's cards byte-identical; a failed refine leaves `deck.status` at
  `completed` with its cards intact.
- `integration/test_worker_pipeline.py` — refinement pipeline with a stubbed LLM: locked
  cards survive verbatim, only new names are enriched, and the six progress events publish in
  order.
- `unit/test_llm_base.py` — `refine_deck` prompt formatting and JSON parsing.
- New `unit/test_refine_reconcile.py` — overshoot, undershoot, copy-cap collision against
  locked copies, Commander singleton, and an all-lands replacement.

Frontend:

- `selection.ts` is pure, so it gets direct unit tests: toggling copies, the stepper's
  first-N-keys behaviour, and `toReplaceRequest` collapsing to the right multiset.

## Not doing

- **Draft retention.** Unsaved drafts accumulate in `decks` forever. A sweep is a Celery beat
  schedule plus a retention policy, and nothing breaks without it.
- **Undo on a draft.** History lives in the saved versions; a refine you dislike is fixed by
  refining again or by reopening the previous version from the library.
- **Renaming or diffing versions.** The library lists them; comparing two versions is a
  separate feature.
- **Manual card swapping.** Replacement always goes through the LLM; there is no
  card-search-and-pick UI.
