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
- **Load the Figma design-to-code guidance BEFORE your first `get_design_context`
  call** — try the `figma-design-to-code` skill; if it is not listed, read the MCP
  resource `skill://figma/figma-design-to-code/SKILL.md`. The server requires it.
- **Screen sections stay page-local.** Six screen agents run in parallel, so a
  shared `components/` folder is a collision. Define sub-components in the page
  file or beside it in the page's own directory, and put page styles in
  `page.module.css`. Cross-screen duplication is expected and is a Wave 5
  dedupe task — do NOT try to pre-share.
- Read design values with `get_design_context(fileKey, nodeId)` on the
  **section-level** node IDs in `docs/figma-node-map.md` — never a whole page
  frame, it truncates. Use `get_screenshot` for visual reference.
- The Figma file defines **no Figma variables** (`get_variable_defs` → `{}`),
  so map raw hex from the design onto the token names in `globals.css`.
- Every screen must render correctly in **both** themes (see Wave 1a).
- Touch only the files your task owns. Two agents editing one file is a bug.
- **DARK IS THE CANONICAL GEOMETRY.** Where a dark frame and its `-light`
  counterpart disagree on any pixel value — padding, gap, size, radius, font
  size, line height — **take the dark frame's number** and use it in both
  themes. The light frames override **colour only**. Read light frames for
  colour and nothing else. Do not average, do not branch geometry per theme.
  Known divergences this resolves: hero top padding `180` (dark `3:18`), not
  `120` (light `20:22`); landing height `5484` not `5524`; my-decks `1744` not
  `1888`; sign-up card `813` not `805`; login card `663` not `659`; 404 inner
  frame `431` not `435`. If you find another, use dark and report it.

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
- [x] **2a — app shell.** `app/layout.tsx` (fonts, providers, theme attribute),
      `app/components/Header/` and `app/components/Footer/` from nodes `3:5`
      and `3:331` (+ light `20:8`/`20:368`). Responsive down to 375px.
- [x] **2b — primitives.** `Button`, `Input`, `Select`, `Card`, `Badge`,
      `Modal`, `Spinner` — variants driven by the design, each its own folder.
- [x] **2c — MTG components.** `ManaSymbol` (all of W/U/B/R/G/C + generic),
      `ManaCurve` chart from node `3:117`, `CardTile`, `ArcaneSigil`.

**Gate:** typecheck + lint clean; every primitive renders in both themes.

### Wave 3 — screens (deps: 2a, 2b, 2c) — all parallel
- [x] **3a — landing** `app/page.tsx` + `app/page.module.css`. Sections
      `3:5 3:18 3:78 3:91 3:117 3:163 3:187 3:273 3:318 3:331`.
- [x] **3b — deck builder** `app/deck-builder/page.tsx`. Node `10:4`,
      workspace `10:22`. Wires `POST /chat`, `POST /decks/generate`,
      `useTaskStream`.
- [x] **3c — my decks** `app/library/page.tsx`. Node `9:4`, content `9:23`.
      Wires `GET /decks`, `DELETE /decks/{id}`.
- [x] **3d — pricing** `app/pricing/page.tsx`. Nodes `16:204`, `16:221`,
      `16:228`, `16:323`.
- [x] **3e — auth** `app/login/page.tsx` + `app/signup/page.tsx`. Nodes
      `16:407`/`16:410` and `16:364`/`16:367`. Supabase Google + GitHub OAuth.
- [x] **3f — 404** `app/not-found.tsx`. Node `16:349`/`16:351`.

**Gate:** typecheck + lint clean; `npm run build` succeeds.

### Wave 4 — integration (deps: wave 3)
- [x] **4a — auth flow.** `app/context/UserContext.tsx`, session persistence,
      route guarding for `/library`, redirect-after-login, sign-out.
- [x] **4b — repo wiring.** *(pulled forward out of order — needed no Figma)* Makefile targets (`dev-v2`, `build-v2`,
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
  `120px` light (`20:22`). **RESOLVED by user decision: dark wins (`180px`).**
  Generalised into a binding rule under "Rules for every subagent" — dark is the
  canonical geometry for every screen, light overrides colour only.
- Smell to watch: the type scale has 22 steps including `--text-pico` (5px) and
  `--text-nano` (6px), harvested verbatim from deck-builder mini-card badges.
  Faithful, but if Wave 3 barely uses the bottom rungs, collapse them.

### Wave 2 findings (verified by controller)

- **Contrast bug in Wave 1a's rule, caught independently by 2a and 2b.** The rule
  "primary buttons use `--crimson` + `--on-accent`" was wrong: `--on-accent`
  `#0a100d` on `--crimson` `#a22c29` measures **2.68:1**, failing even WCAG
  AA-large. The design itself uses cream. **Added `--on-crimson`** (dark
  `#d6d5c9` = 4.86:1 AA, light `#ffffff` = 7.17:1 AAA). Use it for anything on a
  crimson fill; `--on-accent` is for gold fills only. Would have shipped a
  failure on every primary button across all six screens.
- **The design's category colours fail as TEXT, differently per theme.** Fills are
  fine; text is not. Dark: creature 2.68:1, land 2.47:1 both FAIL. Light: spell
  (gold) 2.97:1 FAILS. Added `--type-{creature,spell,land}-fg` — AA-safe in both
  themes, base tokens retained for fills. 2b flagged land; creature and the
  light-theme spell failure were missed by both agents and found by the
  controller.
- **RESOLVED (user decision): light-theme gold darkened.** `--accent` in the
  light and media blocks is now `#7a6a38` (4.81–5.32:1, AA on all three light
  surfaces). **Dark theme keeps the design's `#a68a56` untouched.** This also
  fixed an unnoticed second failure: the gold *fill* button in light was white on
  `#a68a56` at 3.12:1, now 5.32:1.
  Still sub-AA in light and needing a per-usage audit in Wave 5:
  `--accent-mid` `#8b7a40` (3.83:1 — fine for large text/UI, not body text) and
  `--line-accent` `#a68a56` (2.97:1 — it is a border, so the bar is 3:1 not 4.5:1,
  and it lands just under on `--void-1`/`--void-3`).
- **`--type-pico`/`--type-nano` (5px/6px) earn their keep** — CardTile uses both.
  Wave 1a's open question about collapsing the bottom rungs is answered: don't.
- **Three tokens collapse to `#f2f4f1` in light** (`--accent-soft`, `--void-1`,
  `--void-3`), flattening any component that stacks two of them. Added
  `--surface-strip` which resolves 2c's case; the underlying collision remains.
  Wave 3b's deck builder will hit it hardest. Wave 5 item.
- **Legacy shipped ~45 mana PNGs; v2 renders pips in pure CSS instead.**
  `apps/web-app-v2/public/` is empty by design. If Wave 5 wants pixel-identical
  legacy pips, that is the decision point.
- **Header hairline:** `3:5` (landing) has none, but the other three dark headers
  (`9:7`, `10:7`, `16:207`) all carry `rgba(166,138,86,0.2)`. 2a made it
  always-on since dark-canonical majority says present. Wave 5 may rule otherwise.
- **`Header` variant axis is auth state, not route** — `user?: HeaderUser | null`.
  Signed-out `/library` must still show Sign In. Wave 4a wires it from context.
- **Footer hrefs are invented.** The design links to features that do not exist
  (Mana Optimizer, Meta Ticker, API Docs…). Labels kept verbatim, each pointed at
  the nearest real route. Re-point as routes land.
- **Breakpoints 1024px and 640px are INVENTED** — the file is 1440px only. Marked
  as such in the CSS so Wave 5 parity does not flag them.
- **`next/font/google` `axes` and `weight` are mutually exclusive.** DM Sans must
  load with `axes: ['opsz']`, otherwise the `font-variation-settings: 'opsz' 14`
  on `body` is a silent no-op. Corrected in the `globals.css` header comment.
- **Stale `.next` can fail the typecheck gate** — `tsconfig.json` includes
  `.next/types/**/*.ts`, so artifacts from a deleted route produce TS2307 on files
  nobody wrote. **Always `rm -rf .next` before a wave gate.**
- **`npm run build` does not exercise the shell while `app/page.tsx` is absent** —
  Next silently falls back to the pages-router 404 and never compiles
  `layout.tsx`. The build gate only becomes meaningful from Wave 3 on.
- `DeckSummaryCard` (my-decks `9:53`, 384x402) is a distinct component from
  `CardTile` (80x112), not a variant. **Wave 3c owns it.**
- `next.config.ts` has no `images` config, so `CardTile` uses a plain `<img>`.
  Wave 4b decides whether to add Scryfall `remotePatterns` and use `next/image`.

### Wave 4a findings (verified by controller)

- **Real Supabase auth ships as the only production path; a mock stub was added
  for local dev only**, gated behind `NEXT_PUBLIC_MOCK_AUTH=true` (default off).
  `UserContext.tsx` branches once per action on `MOCK_AUTH_ENABLED` — every
  branch pair is symmetric, so turning the flag off restores real auth with no
  code change. Documented at length in the README (`Mock authentication`); not
  duplicated here.
- **Session state lives in a module-level store (`useSyncExternalStore`), not
  provider state.** Guarantees exactly one Supabase/mock listener per page load
  regardless of consumer count, and lets `useUser()` work in a test that never
  mounts `<UserProvider>` — used by `library/layout.tsx`'s route guard tests.
- **`Header`'s `user` prop changed meaning:** `undefined` (the new default) now
  means "read from `UserContext`"; `null` forces signed-out; an object forces
  signed-in. This is a deliberate break from Wave 2a/3's `user = null` default,
  needed so the header can show live session state on every route without every
  screen agent's page wiring it manually. Existing screen usages were audited —
  none passed `user` explicitly, so nothing broke.
- **`/library` is the only guarded route**, per the Wave 1b finding that `GET
  /decks`/`DELETE /decks/{id}` are the only bearer-token endpoints.
  `/deck-builder` stays open on purpose. The guard renders through on
  `checking` (matches the prerendered HTML, avoids a hydration mismatch) and
  redirects only once `status === 'signed-out'`, via `resolveNextPath()` — the
  same open-redirect chokepoint Wave 3 flagged as mandatory.
- `MockAuthBanner` is dev-only chrome: gated both by a parent `{MOCK_AUTH_ENABLED
  ? ... : null}` in `layout.tsx` and inside the component itself, so the
  bundler can tree-shake it out of a real-auth build.

### Wave 4b findings

- Makefile gained `dev-v2` / `build-v2` / `lint-web-app-v2` / `test-web-app-v2`;
  `lint` now includes v2. **Every legacy target is byte-identical** — verified by
  diff. `docker-compose.yml` untouched: the frontend is not a compose service.
- CI `.github/workflows/web-app-v2.yml` pins **node 22**, scoped to
  `apps/web-app-v2/**`. No e2e step — `tests/` has no `*.spec.ts` until Wave 5b,
  and Playwright exits non-zero on "no tests found".
- **The aggregate `test` target deliberately excludes v2** for the same reason.
  Flip `test-web-app-v2` from `test:unit` to `npm test` and add it to `test` once
  5b lands.
- `vitest.config.ts` renamed to **`.mts`** (not `"type": "module"`, which would
  also change resolution for `next.config.ts`, `playwright.config.ts` and
  `eslint.config.mjs`). Vite CJS warning gone. Controller then added `**/*.mts`
  to `tsconfig.json` `include`, which the rename had silently excluded from
  typechecking.
- `"engines": { "node": ">=20.12" }` added to `package.json`.
- **Still open — `next/image`:** `CardTile` uses a plain `<img>` for Scryfall art.
  Adding `images.remotePatterns` for `cards.scryfall.io` buys lazy loading and
  srcset but routes every card through the Next optimizer, which on a 60-card
  grid needs a caching/deploy answer. **Settle in Wave 5a.**

## Resuming this build in a fresh session

This file is the whole state. To pick up after a restart or context loss:

1. `cd apps/web-app-v2` and read this file top to bottom — the backlog checkboxes
   say what is done, the Findings sections say what was learned and what must not
   be repeated.
2. Confirm the Figma MCP server is connected and can read file
   `pgLzux7WT7F98ZEwDpw8lh`, then resume at the lowest wave with unchecked boxes.
3. Gate command (Node >= 20.12 required):
   `rm -rf .next && npx tsc --noEmit && npm run lint && npm run test:unit`
4. Baseline at the time of writing: **268 unit tests, 8 files, all green.**

### Wave 3 findings (verified by controller)

**Two shipped bugs found by screen agents and fixed at the source:**
- `Button` `.btn-subtle` used `--void-2`, which in light is `#ffffff` — identical
  to `Card`'s panel ground, so subtle buttons were INVISIBLE on cards. Added
  `--surface-subtle` (dark `#131a16`, light `#f2f4f1`) and repointed it.
- `Badge` used `--type-{creature,spell,land}` as **text** colour in 4 rules —
  2.47:1, the exact failure the `-fg` tokens were added to prevent. Controller's
  own miss: the `-fg` tokens were added AFTER Wave 2b built `Badge` and existing
  usage was never swept. Text now uses `-fg`; borders keep the design hue.

**Three agents independently refused to fabricate data.** The design shows
`Synergy Match 94%`, `Win Rate 64.2%`, `SYNERGY RATIO 94.8%` and
`64.2% Estimated Winrate`. No backing field exists anywhere in the backend.
3b and 3c both **deleted** these rather than hardcoding plausible numbers, and
kept the surrounding geometry using only real fields. Also dropped for the same
reason: `Duplicate` (no endpoint), `Save Deck` (no endpoint — replaced with a
`?deck=` permalink), `Export PDF` (needs a dependency), and the `sync-banner`
claiming "MTG Arena & Moxfield Integration Active" for a feature that does not
exist. **These are design-vs-reality gaps for the user to reconcile, not bugs.**

**Contrast, third instance.** `--crimson` as TEXT is 2.68:1 on `--void-0` and
2.46:1 on `--void-2` — the landing stat numbers fail even the 3:1 large-text bar.
Added `--crimson-fg` (dark `#d97b76`, light `#a22c29`); requested independently
by 3a and 3d. That is now three separate contrast failures in the source design.

**A real responsive bug, found and fixed by 3a:** fixed grid tracks
(`repeat(4, minmax(296px,1fr))` with `min-width: 405px` cards) demanded 1280px of
track between 1024px and ~1264px, where neither breakpoint applies — content
clipped under the global `overflow-x: hidden`. Fixed with
`repeat(auto-fit, minmax(min(<card-w>, 100%), 1fr))`. **Other screens likely have
the same latent bug — Wave 5 must check every grid.**

**Concurrent `npm run build` in one working tree corrupts `.next`.** Four agents
hit distinct post-compile filesystem races (`build-manifest.json`,
`500.html` rename, `pages-manifest.json`, `PageNotFoundError: /_document`), none
of them code faults. **Wave gates must serialise the build.**

**`useAutoScroll` was the wrong tool for the chat transcript** — it is a
horizontal infinite marquee scroller, not a vertical pin-to-bottom. Controller's
briefing error; `ChatPanel` keeps a 3-line local effect.

**Design vs Supabase mismatch, NEEDS A DECISION:** the auth frames show
**Google + Discord**, with Lucide placeholder glyphs (`circle-x`, `app-window`)
rather than brand marks. Discord is NOT configured in Supabase and would 400.
Wired Google + GitHub (matching legacy). Either enable Discord or accept the
design is out of date.

**Open-redirect guard:** `resolveNextPath()` in `app/login/authShared.ts` is the
single chokepoint for the whole auth surface — rejects absolute,
protocol-relative, backslash-smuggled and `://`-bearing values. **Wave 4a MUST
route through it and never pass a raw query value to `router.replace`.**
OAuth uses supabase-js implicit flow, so no `/auth/callback` route is needed
today; moving to PKCE means adding one and editing `oauthRedirectTo()` only.

**Controller token audit (replaces the one 3f lost):**
- Tokens referenced but undefined: **none**. (`--bar-fill`/`--bar-index` in
  `ManaCurve.css` are set inline from TSX — a false positive.)
- Hardcoded colours outside `globals.css`: **4**, all in `ManaSymbol.css`, all
  theme-invariant physical shading on the pips (inset highlight/shadow), and
  documented in-file. Accepted.
- Light-block parity: **46 tokens in each**, perfectly symmetric.

**Other seams and gaps:**
- `GET /decks` has **no sort or filter params** (hardwired `created_at DESC`), so
  library sort/search/filter act on the loaded page only. Surfaced in the UI.
- `docs/api-contract.md` omits that `GET /decks` returns full `DeckResponseDTO`s
  **including `cards`** — that is what makes real cover art possible.
- `/deck-builder?deck=<uuid>` is 3c's Edit target and 3b's permalink. Both sides
  implemented; confirm end to end in Wave 5.
- Budget + sideboard have no field in `DeckGenerateRequest`; 3b folds them into
  the prompt prose that `parse_intent` reads, rather than shipping dead widgets.
- All raster assets are Figma-CDN URLs on 7-day expiry and `public/` is empty —
  hero card art, feature plates, testimonial portraits and the CTA photograph are
  all token-built surfaces. **Wave 5a decision: export real assets or keep these.**
- Pricing FAQ is native `<details>`/`<summary>` — zero client JS, works with JS
  off. Node `16:323` contradicts itself (a `+` marker on every row AND every
  answer expanded); resolved in favour of the marker. Parity diff is intentional.
- The auth frames have no header/footer, but `layout.tsx` wraps every route.
  Wave 5a parity decision.
- **`figma-design-to-code` skill is NOT registered in this harness** and agents
  have no MCP-resource reader, so the Figma server's required guidance could not
  be loaded by any Wave 3 agent. Register it before Wave 5a.

**Wave 3 gate (serial): tsc clean, eslint clean, 247 tests / 7 files, build green
with all 7 routes prerendered static.**

