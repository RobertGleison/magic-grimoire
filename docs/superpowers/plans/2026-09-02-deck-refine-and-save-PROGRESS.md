# Deck Refine & Save — Execution Progress

**Resume instruction:** read this file, then continue executing
`docs/superpowers/plans/2026-09-02-deck-refine-and-save.md` from the first task
marked ⬜ below, using the `superpowers:subagent-driven-development` loop.

**Branch:** `alternative_ui` (the user chose to work directly on it — no worktree,
nothing to merge afterwards). Spec: `docs/superpowers/specs/2026-09-02-deck-refine-and-save-design.md`.

---

## The execution loop (per task)

1. Dispatch ONE implementer subagent (never two in parallel — they share a branch
   and would conflict). Paste the task's **full text** from the plan into the
   prompt; do not make the subagent read the plan file. Add scene-setting context
   and an explicit scope limit naming what belongs to later tasks.
2. On DONE, dispatch a **spec compliance** reviewer. Tell it not to trust the
   implementer's report and to re-run the tests itself.
3. Only after spec ✅, dispatch a **code quality** reviewer
   (`superpowers:code-reviewer` agent type) with BASE_SHA and HEAD_SHA.
4. Reviewer findings → same implementer fixes → re-review. Judge findings on
   merit; don't implement a reviewer suggestion that is wrong.
5. Mark the task ✅ here, then move on.

Model choice: `haiku` for mechanical tasks where the plan gives complete code,
`sonnet` for multi-file/integration tasks and for reviews.

---

## Task status

| # | Task | Status | Commits |
|---|---|---|---|
| 1 | Deck model — version columns | ✅ spec ✅ quality ✅ | `5b9f024`, `ecdccf7` |
| 2 | Migration 002 | ✅ spec ✅ quality ✅ | `8030c46` |
| 3 | `version_no` on DTO; library returns only snapshots | ⚠️ implemented — **both reviews owed** | `5c484b2` |
| 4 | `POST /decks/{id}/save` | ⬜ | |
| 5 | `saveDeck` in API client | ⬜ | |
| 6 | Save button in deck header | ⬜ | |
| 7 | Signed-out save round-trip through login | ⬜ | |
| 8 | Version number on library card | ⬜ | |
| 9 | `refine_plan.py` — locked/replaced split | ⬜ | |
| 10 | `refine_plan.py` — reconciliation and merge | ⬜ | |
| 11 | Refine prompt + `LLMService.refine_deck` | ⬜ | |
| 12 | Extract `_TaskPipeline` base | ⬜ | |
| 13 | `DeckRefinementPipeline` | ⬜ | |
| 14 | `POST /decks/{id}/refine` | ⬜ | |
| 15 | `selection.ts` | ⬜ | |
| 16 | `refineDeck` in API client | ⬜ | |
| 17 | Selectable cards in grid and list | ⬜ | |
| 18 | `RefineTray` | ⬜ | |
| 19 | Wire the refine request into the page | ⬜ | |
| 20 | Full verification | ⬜ | |

**Next action — do this first, before starting Task 4:**

1. **Task 3 spec compliance review** (BASE `3cb71a1`, HEAD `5c484b2`). The
   implementer reported DONE: DTO gained `version_no: int | None = None`, both
   `list_decks` queries now filter `Deck.saved_at.is_not(None)`, ordering changed
   from `created_at DESC` to `saved_at DESC`, and the new test
   `test_list_decks_excludes_drafts_and_orders_by_saved_at` was appended. Claims
   15 tests in the integration file, 108 in the full backend suite, ruff clean.
   **The thing to scrutinise:** it modified one pre-existing test,
   `test_list_paginates_own_decks_only`, giving each of its four inserted decks a
   `saved_at` and a `version_no` so they remain visible under the new filter. Its
   stated reasoning is that the test's intent is pagination scoping, unrelated to
   draft/snapshot semantics. Verify by reading the diff that no assertion was
   weakened — `total == 3`, `pages == 2`, `len(decks) == 2` should all still be
   asserted. This is the likeliest place for a quietly loosened test.
2. **Task 3 code quality review**, only after spec passes.
3. Then Task 4.

---

## Push state

`origin/alternative_ui` is at **`26c3752`** — the user asked to push only what
predates Task 1, so the remote has the design spec and the plan and nothing else.
Everything from `5b9f024` onward is local and unpushed. Do not push further
without asking.

`git status` will always show this progress file as modified — it is updated as
tasks land, so the committed copy lags the working copy. That is expected; commit
it when convenient. Task-implementer subagents correctly leave it out of their
commits.

## Commits so far

```
5c484b2 feat(api-server): list only saved deck snapshots in the library
3cb71a1 docs(plans): track execution progress and environment gotchas
8030c46 feat(api-server): migrate decks to versioned drafts and snapshots
ecdccf7 docs(api-server): describe lineage_id as the opaque group key it is
b23e6cc chore(api-server): sort imports in pipeline.py so ruff check passes
5b9f024 feat(api-server): add saved_at, lineage_id and version_no to Deck
26c3752 docs(plans): implementation plan
e921ad1 docs(specs): design
```

`b23e6cc` is not part of any task: `ruff check .` was already failing repo-wide on
a pre-existing unsorted import in `app/decks/pipeline.py` (left by `8a401c1`,
which moved `app.llm`). It was fixed so the lint gate in the remaining tasks
actually means something. Lint is now clean repo-wide.

---

## Decisions and deviations

- **Task 1, `lineage_id` comment rewritten (`ecdccf7`).** The code-quality
  reviewer flagged `default=uuid.uuid4` as a footgun and suggested a
  `before_insert` listener forcing `lineage_id = id`. Rejected as unnecessary:
  nothing depends on `lineage_id` equalling the row's id — version numbering only
  does `max(version_no) WHERE lineage_id = ?`, and grouping only needs equality,
  so a fresh UUID for a new root deck is correct. The real risk is the *copy*
  paths (Task 4 snapshot, Task 14 fork) forgetting to carry the source's value
  forward, which would restart version numbers at 1 and show "v1" twice; both
  tasks set it explicitly AND assert lineage equality in their tests, so that is
  already defended. Only the comment was wrong (it claimed root drafts set
  `lineage_id` to their own id, which no task does) — so the comment was corrected
  instead.
- **Migration backfill verified against real data.** The dev database holds 23
  decks; all 23 backfilled to `lineage_id = id`, `saved_at = created_at`,
  `version_no = 1`. This is what keeps them visible in `/library` once Task 3
  makes `GET /decks` filter on `saved_at`. (The Task 2 implementer reported "5
  rows" — it had run a `LIMIT 5` query; the spec reviewer caught the discrepancy.)

---

## Environment gotchas

- **`apps/api-server/.env` is stale and breaks Alembic.** It points
  `DATABASE_URL` at `localhost:5434` as user `user`, but `docker-compose.yml`
  publishes Postgres on `5432` as `postgres/postgres`. Alembic reads the `.env`
  and fails with `InvalidPasswordError`. Override on the command line and do NOT
  edit the user's `.env`:
  ```bash
  cd apps/api-server
  export DB="postgresql+asyncpg://postgres:postgres@localhost:5432/magic_grimoire"
  DATABASE_URL="$DB" uv run alembic upgrade head
  ```
  Integration tests are unaffected — `tests/conftest.py` sets its own
  `DATABASE_URL` (database `magic_grimoire_test`) before config is imported.
- **Dev database is at revision `002 (head)`.**
- Services: `docker-compose up -d postgres redis` (both were already running).
- Integration tests build their schema with `Base.metadata.create_all`, not
  Alembic — so a model change alone makes tests see new columns.
- Backend tests are async with pytest-asyncio in auto mode: existing tests carry
  no `@pytest.mark.asyncio`, so don't add one.
- The `api` container has no volume mount — `docker-compose up -d --build api` is
  needed to pick up backend changes in the running container.
- **Frontend tasks (15–19) need Node 20+.** The default `node` on this machine is
  v18.19.1 and vitest/rolldown dies at startup with `node:util does not provide
  an export named 'styleText'`. Every frontend subagent prompt MUST include:
  ```bash
  export PATH=~/.nvm/versions/node/v22.23.2/bin:$PATH
  ```
  Also, the `rtk` shell hook mangles vitest's reporter output ("All parsing tiers
  failed"); run it as `rtk proxy "npx vitest run ..."` to see real pass/fail counts.

## Verification commands

```bash
# backend
cd apps/api-server && uv run pytest -q && uv run ruff check .
# frontend (Node 20+ required — see gotcha above)
export PATH=~/.nvm/versions/node/v22.23.2/bin:$PATH
cd apps/web-app && npm run test:unit && npm run typecheck && npm run lint && npm run build
```
