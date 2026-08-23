# RALPH — web-app-v2 build loop

Rebuild of the Magic Grimoire frontend from the Figma design
`https://www.figma.com/design/pgLzux7WT7F98ZEwDpw8lh/Magic-Grimoire`.
`apps/web-app/` is the legacy version and is **never modified** by this loop.

## Loop protocol

Each iteration, the controller (main session):

1. Reads this file and picks the **lowest-numbered wave with unchecked tasks**
   whose dependency waves are fully checked.
2. Dispatches **one subagent per task** in that wave, all in parallel.
3. On return, runs the wave's verification gate.
4. Ticks completed boxes here, appends anything discovered to **Findings**.
5. Commits the wave as one checkpoint, then repeats.

Loop exits when every box is checked and the Wave 5 gate passes.

## Rules for every subagent

- **Never run `git commit`, `git add`, `git push`, or any branch operation.**
  The controller owns git. Report changed paths in your final message instead.
- Follow `.claude/skills/frontend-robert/SKILL.md` exactly: one folder per
  component, `Name/Name.tsx` + `Name/Name.css`, named exports, no `index.tsx`
  barrels, `'use client'` only where hooks/events/browser APIs are used, prop
  interface inline above the component.
- **Zero hardcoded colors, fonts, radii, or spacing.** CSS custom properties
  from `app/globals.css` only.
- **`app/globals.css` is OWNED BY THE CONTROLLER from Wave 2 onward.** Waves run
  agents in parallel, so a shared file is a merge conflict waiting to happen.
  Never edit it. If a token you need is missing, use the closest existing one and
  list the exact token name + value you want in your final report — the
  controller applies it between waves.
- Stack is fixed: Next.js 15.5.18 App Router, React 19, TypeScript strict,
  plain CSS, framer-motion, `@supabase/supabase-js`. **No Tailwind, no CSS-in-JS,
  no new dependencies** without flagging it first.
- Read design values with `get_design_context(fileKey, nodeId)` on the
  **section-level** node IDs in `docs/figma-node-map.md` — never a whole page
  frame, it truncates. Use `get_screenshot` for visual reference.
- The Figma file defines **no Figma variables** (`get_variable_defs` → `{}`),
  so map raw hex from the design onto the token names in `globals.css`.
- Every screen must render correctly in **both** themes (see Wave 1a).
- Touch only the files your task owns. Two agents editing one file is a bug.

## Backlog

### Wave 0 — scaffold (controller, done)
- [x] `apps/web-app-v2/` created, deps installed, configs mirrored from legacy
- [x] `docs/api-contract.md`, `docs/figma-node-map.md`, this file

### Wave 1 — foundation (no deps)
- [x] **1a — theme + tokens.** Extract every colour, font, size, radius and
      spacing value from both landing frames (`3:4` dark, `20:7` light) plus
      spot-checks of `10:4`/`20:647`. Write `app/globals.css` with `:root`
      (dark) + `[data-theme="light"]` + `prefers-color-scheme` fallback, reusing
      the legacy token vocabulary (`--void-*`, `--accent*`, `--cream`, `--muted`,
      `--mana-*`, `--font-*`, `--radius`, `--line`). Add
      `app/context/ThemeContext.tsx` (localStorage-backed, no flash on load) and
      `app/components/ThemeToggle/`. Deliver `docs/tokens.md` mapping hex → token.
- [x] **1b — API layer.** `app/types/api.ts` (mirror `docs/api-contract.md`
      exactly), `app/lib/apiClient.ts` (typed fetch, Bearer injection, error
      normalisation), `app/lib/supabase.ts`, `app/hooks/useTaskStream.ts` (SSE
      against `/api/v1/tasks/{id}/stream`, handles all six `TaskProgress`
      values, reconnect + cleanup), `app/hooks/useAutoScroll.ts`. Unit tests in
      `tests/unit/` for the client and the stream reducer. No UI.

**Gate:** `npm run typecheck` and `npm run lint` clean; `npm run test:unit` green.

### Wave 2 — shared shell + primitives (deps: 1a, 1b)
- [ ] **2a — app shell.** `app/layout.tsx` (fonts, providers, theme attribute),
      `app/components/Header/` and `app/components/Footer/` from nodes `3:5`
      and `3:331` (+ light `20:8`/`20:368`). Responsive down to 375px.
- [ ] **2b — primitives.** `Button`, `Input`, `Select`, `Card`, `Badge`,
      `Modal`, `Spinner` — variants driven by the design, each its own folder.
- [ ] **2c — MTG components.** `ManaSymbol` (all of W/U/B/R/G/C + generic),
      `ManaCurve` chart from node `3:117`, `CardTile`, `ArcaneSigil`.

**Gate:** typecheck + lint clean; every primitive renders in both themes.

### Wave 3 — screens (deps: 2a, 2b, 2c) — all parallel
- [ ] **3a — landing** `app/page.tsx` + `app/page.module.css`. Sections
      `3:5 3:18 3:78 3:91 3:117 3:163 3:187 3:273 3:318 3:331`.
- [ ] **3b — deck builder** `app/deck-builder/page.tsx`. Node `10:4`,
      workspace `10:22`. Wires `POST /chat`, `POST /decks/generate`,
      `useTaskStream`.
- [ ] **3c — my decks** `app/library/page.tsx`. Node `9:4`, content `9:23`.
      Wires `GET /decks`, `DELETE /decks/{id}`.
- [ ] **3d — pricing** `app/pricing/page.tsx`. Nodes `16:204`, `16:221`,
      `16:228`, `16:323`.
- [ ] **3e — auth** `app/login/page.tsx` + `app/signup/page.tsx`. Nodes
      `16:407`/`16:410` and `16:364`/`16:367`. Supabase Google + GitHub OAuth.
- [ ] **3f — 404** `app/not-found.tsx`. Node `16:349`/`16:351`.

**Gate:** typecheck + lint clean; `npm run build` succeeds.

### Wave 4 — integration (deps: wave 3)
- [ ] **4a — auth flow.** `app/context/UserContext.tsx`, session persistence,
      route guarding for `/library`, redirect-after-login, sign-out.
- [ ] **4b — repo wiring.** Makefile targets (`dev-v2`, `build-v2`,
      `lint-web-app-v2`, `test-web-app-v2`), `.github/workflows/web-app-v2.yml`
      scoped to `apps/web-app-v2/**`, `apps/web-app-v2/README.md`.

**Gate:** typecheck + lint + build + unit tests all green.

### Wave 5 — verification (deps: wave 4)
- [ ] **5a — visual parity.** Per screen, `get_screenshot` vs the built page;
      report per-section diffs. Fix what's wrong, list what's deliberate.
- [ ] **5b — a11y + e2e.** Playwright smoke per route, `@axe-core/playwright`
      pass, keyboard nav, both themes.

**Gate:** full `npm test` green; parity report has no unexplained diffs.

## Findings

_Appended by the controller as waves land._

- Wave 0: legacy `CLAUDE.md` claims Tailwind CSS 4, but `apps/web-app` has no
  Tailwind dependency — real convention is component-scoped CSS + custom
  properties. v2 follows the real convention. `CLAUDE.md` needs a correction.
- Wave 0: legacy route is `/deck-builder`, not `/grimoire` as `CLAUDE.md` says.
- Wave 0: backend has an undocumented `app/chat` module (`POST /api/v1/chat`).
- Wave 0: Figma file has no Figma variables; tokens must be derived from raw hex.
- Wave 0: v2 dev server runs on **3001** so it can run beside legacy on 3000.

### Wave 1b findings (verified by controller)

- **SSE is deliberately unauthenticated.** `apps/api-server/app/tasks/routes.py`
  carries an explicit comment: the task ID is an unguessable UUIDv4 acting as a
  capability URL and events carry progress strings only. So native `EventSource`
  is correct and no bearer-token stream parser is needed. Its built-in retry is
  replaced with bounded exponential backoff that halts on a terminal event.
- **The SSE payload is NOT `TaskStatusResponse`.** Wire shape is a bare
  `{status, message}` published in `app/decks/pipeline.py` — no `id` field.
  `TaskStatusResponseDTO` exists but no route returns it. Modelled separately as
  `TaskProgressEvent`. **`docs/api-contract.md` is wrong here.**
- **`docs/api-contract.md` says "five pipeline stages"; there are six.** The enum
  table is right, the prose is wrong. Fix the prose.
- **`DeckResponse.format`/`.colors` are plain `str`/`list[str]` server-side**, not
  the enums the contract implies. Types mirror the backend, not the contract.
- **`ChatContext.colors` excludes `C`** (`Literal["W","U","B","R","G"]`) while
  `DeckGenerateRequest.colors` includes it. Separate `ChatColor` type.
- **Undocumented pagination:** `page >= 1` (default 1), `limit` 1..100 (default 20).
- **Undocumented per-endpoint auth:** `GET /decks` and `DELETE /decks/{id}` require
  a token (401 without). `POST /decks/generate`, `GET /decks/{id}`, `POST /chat`
  work signed out. `GET /decks/{id}` 403s on someone else's deck.
- **Legacy 429 handling is dead code.** `apps/web-app/app/deck-builder/page.tsx`
  special-cases HTTP 429 ("You've used your free build") but the backend has no
  rate limiting anywhere. **Wave 3b must not port that branch.**
- **Node >= 20.12 required to run the tests.** vitest 4 pulls in rolldown.
  The nvm Node on PATH (18.19.1) fails with a `styleText` import error; gates
  were run on Node 23.10.0. Correction to the subagent's report: CI is NOT
  blocked — `.github/workflows/web-app.yml` already pins `node-version: 20`,
  which resolves above 20.12. Wave 4b should still add
  `"engines": { "node": ">=20.12" }` to make the floor explicit.
- **`@rolldown/binding-darwin-arm64` can be missing from a fresh install**
  (npm optional-dependency bug) even though it is in the lockfile. Wave 4b should
  document the `npm install --no-save @rolldown/binding-darwin-arm64` workaround
  in the README.
- Minor: `vitest.config.ts` triggers a Vite CJS/ESM config warning. Harmless now,
  will break when Vite flips the default loader. Wave 4b: rename to
  `vitest.config.mts` or add `"type": "module"`.

### Wave 1a findings (verified by controller)

- **The design is a rebrand, not a reskin.** Every foundational value changed:

  | token | legacy | v2 (design) |
  |---|---|---|
  | `--void-0` | `#08060a` purple-black | `#0a100d` green-black |
  | `--accent` | `#e8c76a` bright gold | `#a68a56` muted gold |
  | `--cream` | `#f0e4c8` warm | `#d6d5c9` cool |
  | `--font-display` | Cinzel Decorative | DM Serif Text |
  | `--font-body` | Cormorant Garamond | DM Sans |

- **There are TWO accents.** `--crimson` `#a22c29` is the primary action colour;
  gold `--accent` is ornamental/labels only. **Primary buttons use `--crimson`
  + `--on-accent`, never `--accent`.** No legacy equivalent exists.
- **Fonts for Wave 2a:** DM Serif Text 400 (`--font-dm-serif-text`), DM Sans
  400/500/600/700 (`--font-dm-sans`). JetBrains Mono is NOT in the design — load
  only if a screen actually needs `--font-mono`. `font-variation-settings:
  "opsz" 14` is set once on `body`; components must not repeat it.
- **Wave 2a must inject `themeInitScript`** (exported from `ThemeContext.tsx`) as
  a plain inline `<script dangerouslySetInnerHTML>` in `<head>` — NOT
  `next/script`, whose strategies all run post-hydration and would flash.
- **No theme toggle exists anywhere in the Figma file.** `ThemeToggle` is net-new;
  geometry borrowed from the sideboard switch (`20:716`, 40x20).
- **No mana symbols and no MTG colour palette in the design** — its colour
  pickers use neutral surfaces with `#111`/`#a22c29` for selected state. Legacy
  `--mana-*` values retained. **Wave 2c must port `ManaSymbol` from legacy
  rather than expect a design source.**
- **No letter-spacing, no easing, no motion data in the file.** `--tracking-*`,
  `--ease`, all durations and 5 of the 17 keyframes are additions, flagged in
  `docs/tokens.md` under "Unresolved / assumed".
- **`--crimson-glow` is `144, 41, 35`, deliberately not the RGB of `--crimson`
  (`162, 44, 41`)** — that is what Figma reports for the red drop-shadows.
- Hero top padding differs by theme in the design: `180px` dark (`3:18`) vs
  `120px` light (`20:22`). **Wave 3a must decide if that is intentional.**
- Smell to watch: the type scale has 22 steps including `--text-pico` (5px) and
  `--text-nano` (6px), harvested verbatim from deck-builder mini-card badges.
  Faithful, but if Wave 3 barely uses the bottom rungs, collapse them.

