# Magic Grimoire — Web App v2

A from-scratch rebuild of the Magic Grimoire frontend against the Figma design
([`Magic-Grimoire`](https://www.figma.com/design/pgLzux7WT7F98ZEwDpw8lh/Magic-Grimoire)).
`apps/web-app/` is the **legacy** version and is never modified by this work.

Same backend, same contract, new everything else: the design is a rebrand rather
than a reskin, so the token vocabulary carried over but every value behind it
changed. Development is driven by the wave loop in [`RALPH.md`](./RALPH.md).

v2 runs on **port 3001**, legacy runs on **3000**, so both can be up at once and
compared side by side against the same API.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Layout](#project-layout)
- [Local Development](#local-development)
- [Mock authentication](#mock-authentication)
- [Node Version](#node-version)
- [Theming Contract](#theming-contract)
- [Component Conventions](#component-conventions)
- [Testing](#testing)
- [Repo Targets & CI](#repo-targets--ci)
- [Docs](#docs)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15.5 (App Router), React 19 |
| Language | TypeScript (strict) |
| Styling | **Plain CSS with custom properties** — one `.css` file per component |
| Animation | Framer Motion |
| Auth | Supabase JS client (Google + GitHub OAuth) |
| Unit tests | Vitest + Testing Library |
| E2E tests | Playwright (+ `@axe-core/playwright`) — specs land in RALPH wave 5b |

> **There is no Tailwind here.** The repo-root `CLAUDE.md` claims "Tailwind CSS 4"
> for the frontend; that is wrong for *both* apps. Neither `apps/web-app` nor
> `apps/web-app-v2` has a Tailwind dependency. The real convention is
> component-scoped plain CSS driven by custom properties declared in
> `app/globals.css`. No CSS-in-JS, no utility framework.

---

## Project Layout

```
apps/web-app-v2/
├── app/
│   ├── globals.css          # Every design token, all three theme blocks
│   ├── layout.tsx           # Fonts, providers, blocking theme init script
│   ├── layout.css
│   ├── components/          # One folder per component: Name/Name.tsx + Name/Name.css
│   ├── context/
│   │   └── ThemeContext.tsx  # Theme state + exported `themeInitScript`
│   ├── hooks/                # useTaskStream (SSE), useAutoScroll
│   ├── lib/                  # apiClient (typed fetch, Bearer injection), supabase
│   └── types/api.ts          # Mirrors the backend, not docs/api-contract.md — see below
├── docs/                     # tokens.md, api-contract.md, figma-node-map.md
├── tests/
│   ├── setup.ts
│   └── unit/                 # Vitest specs
├── next.config.ts            # /api/* proxy
├── vitest.config.mts
└── RALPH.md                  # Build plan, wave findings, open questions
```

---

## Local Development

```bash
cd apps/web-app-v2
npm install

# Create apps/web-app-v2/.env.local with:
#   NEXT_PUBLIC_SUPABASE_URL=<your Supabase project URL>
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your Supabase anon key>

npm run dev        # http://localhost:3001
```

From the repo root, `make dev-v2` brings the backend up with Docker Compose and
then runs the v2 dev server in the foreground.

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | Supabase project URL (client-side) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` | Supabase anon key (client-side) |
| `NEXT_PUBLIC_MOCK_AUTH` | `.env.local` | **Dev only.** `true` replaces Supabase auth with a stub — see [Mock authentication](#mock-authentication). Absent/`false` = real auth. |
| `API_ORIGIN` | shell / `.env.local` | Backend origin for the `/api/*` proxy. Defaults to `http://localhost:8000`. |

`next.config.ts` rewrites `/api/:path*` → `${API_ORIGIN}/api/:path*`, so every
`/api/v1/...` call — the SSE progress stream included — goes through the Next dev
server to the locally running FastAPI backend. There is no Docker service for the
frontend; run it locally alongside `docker compose up` for the backend.

---

## Mock authentication

> **Never deploy with `NEXT_PUBLIC_MOCK_AUTH=true`.** It disables authentication
> completely. Anyone who can open the page is signed in.

Real Supabase auth is deferred, so the app ships a development stub behind one
environment variable.

```bash
# apps/web-app-v2/.env.local
NEXT_PUBLIC_MOCK_AUTH=true    # stub on   — any credentials work
NEXT_PUBLIC_MOCK_AUTH=false   # stub off  — real Supabase auth (also the default
                              #             when the line is absent entirely)
```

Only the exact string `true` enables it. Next.js inlines `NEXT_PUBLIC_*` at build
time, so restart the dev server after changing it.

**What the stub does** (`app/lib/mockAuth.ts`):

- **Any** non-empty password signs in, for any address that looks like an email.
  The email is still shape-checked so the form's own validation stays meaningful.
- Sign-up works the same and remembers the display name; with no name given, one
  is derived from the email local-part.
- **The password is never stored** — not hashed, not compared, not logged. It is
  read once to confirm it is non-empty and discarded.
- The Google and GitHub buttons are hard no-ops. They resolve without navigating
  and the form shows "provider sign-in is disabled", never a fake success.
- The fake session lives in `localStorage` under `mg.mockAuth.session`. Every
  read and write is wrapped in `try`/`catch`, so private windows still work.
- `mg.mockAuth.session` holds `accessToken: 'mock-access-token'`, which is a
  placeholder, **not** a JWT, and is never sent anywhere.

**How you can tell it is on:**

1. A red banner across every page: "Authentication is MOCKED…" (dismissible for
   the current tab only).
2. A `console.warn` on load naming `NEXT_PUBLIC_MOCK_AUTH`.
3. `localStorage` shows a key with `mock` in its name.

**What still does not work while mocked.** The backend is untouched and still
requires a real Supabase JWT. `app/lib/supabase.ts#getAccessToken()` reads the
*Supabase* session, which does not exist in mock mode, so no `Authorization`
header is sent and `GET /decks` / `DELETE /decks/{id}` return **401**. `/library`
therefore lets you in (the client-side guard sees a session) and then shows its
"The seal is closed" panel when the list request 401s. `POST /decks/generate`,
`GET /decks/{id}` and `POST /chat` are unauthenticated server-side and work
normally.

**Turning it off restores real auth with no code change.**
`app/context/UserContext.tsx` implements *both* branches — mock and
`@supabase/supabase-js` — and `app/lib/supabase.ts`, `app/login/authShared.ts`
and the open-redirect guard `resolveNextPath()` were never modified for the stub.

---

## Node Version

**Node >= 20.12 is required** (`engines` enforces the floor; CI pins 22).

Vitest 4 pulls in rolldown, which imports `styleText` from `node:util`. That
export landed in 20.12, so anything older dies at test startup with:

```
SyntaxError: The requested module 'node:util' does not provide an export named 'styleText'
```

If you use nvm and its default is older (18.x is a common one here), switch
before running the test suite.

### Known npm bug: missing rolldown binary

npm's optional-dependency resolution can leave `@rolldown/binding-darwin-arm64`
in `package-lock.json` but absent from `node_modules`, so Vitest fails to start
on a *fresh* install. Workaround:

```bash
npm install --no-save @rolldown/binding-darwin-arm64
```

(Substitute the binding for your platform on non-Apple-Silicon machines.)

---

## Theming Contract

Dark is the primary theme and the **canonical geometry**. Light overrides colour
only — where a dark Figma frame and its light counterpart disagree on any pixel
value (padding, gap, size, radius, font size, line height), the dark number wins
in both themes.

Three blocks in `app/globals.css`, in this order:

1. `:root` — **dark**, the default.
2. `:root[data-theme="light"]` — explicit user choice.
3. `@media (prefers-color-scheme: light) :root:not([data-theme="dark"])` —
   system-preference fallback for visitors who have not chosen.

**Every token must be defined in all three blocks.** A token that only exists in
`:root` silently keeps its dark value when the page flips to light, which reads as
a one-off contrast bug rather than a missing declaration. Blocks 2 and 3 carry
identical payloads.

`themeInitScript` (exported from `app/context/ThemeContext.tsx`) **must stay a
blocking inline `<script dangerouslySetInnerHTML>` in `<head>`** — it reads
localStorage and stamps `data-theme` before first paint. Do not convert it to
`next/script`: every strategy that component offers runs post-hydration, which
reintroduces the flash of the wrong theme. `<html>` carries
`suppressHydrationWarning` because of it.

Add tokens per [`docs/tokens.md` § How to add a token](./docs/tokens.md). During
the RALPH loop, `app/globals.css` is owned by the controller — subagents report
the token they need instead of editing it.

---

## Component Conventions

**[`.claude/skills/frontend-robert/SKILL.md`](../../.claude/skills/frontend-robert/SKILL.md)
is the binding convention for every component, page and stylesheet in this app.**
Read it before writing UI code. In short: one folder per component
(`Name/Name.tsx` + `Name/Name.css`), named exports only, no `index.tsx` barrels,
`'use client'` only where hooks/events/browser APIs are used, prop interface
inline above the component, and **zero hardcoded colours, fonts, radii or
spacing** — tokens only.

Two token rules have already caused real bugs; both are easy to get backwards:

- **Use `--on-crimson` on a crimson fill, never `--on-accent`.** `--on-accent`
  (`#0a100d`) exists for text on the *gold* `--accent` fill. On `--crimson`
  (`#a22c29`) it measures 2.68:1 and fails even WCAG AA-large; `--on-crimson`
  measures 4.86:1 dark / 7.17:1 light. Every primary button in the design is a
  crimson fill, so getting this wrong ships a contrast failure app-wide.
- **`--type-*-fg` is for text; `--type-*` is for fills.** The design's card-type
  colours (`--type-creature`, `--type-spell`, `--type-land`) are fine as
  backgrounds but fail as text — and fail *differently* per theme (creature
  2.68:1 and land 2.47:1 in dark; spell 2.97:1 in light). Use the `-fg` variants
  for any text or icon, the base tokens for fills only.

---

## Testing

```bash
npm run test:unit       # Vitest — tests/unit/**/*.test.{ts,tsx}
npm run test:e2e        # Playwright — tests/**/*.spec.ts (auto-starts npm run dev on 3001)
npm test                # both, in sequence
npm run typecheck       # tsc --noEmit
npm run lint            # eslint .
```

Unit specs cover the API client, the task-stream reducer, the MTG helpers and the
primitives. **There are no Playwright specs yet** — RALPH wave 5b owns them, and
`playwright test` exits non-zero when it finds none, so `npm test` and
`make test-web-app-v2` are unit-only until those land.

Vitest is configured in `vitest.config.mts` — the `.mts` extension, not `.ts`, so
Vite loads it as ESM instead of warning about "ESM syntax in a file loaded as
CommonJS".

> **Always `rm -rf .next` before running the typecheck gate.** `tsconfig.json`
> includes `.next/types/**/*.ts`, so stale generated types from a deleted route
> produce `TS2307` errors on files nobody wrote.

> `npm run build` does not exercise the App Router while `app/page.tsx` is absent
> — Next falls back to the pages-router 404 and never compiles `layout.tsx`. The
> build gate only becomes meaningful once wave 3 lands the screens.

---

## Repo Targets & CI

From the repo root:

| Target | Does |
|---|---|
| `make dev-v2` | `docker-compose up -d`, then the v2 dev server on 3001 |
| `make build-v2` | `npm run build` |
| `make lint-web-app-v2` | `npm run lint` (also part of the aggregate `make lint`) |
| `make test-web-app-v2` | `npm run test:unit` |

`.github/workflows/web-app-v2.yml` runs install → lint → typecheck → unit tests →
build on Node 22, scoped to `apps/web-app-v2/**` and the workflow file itself.
Legacy `web-app` keeps its own workflow and its own targets; the two never
trigger each other.

---

## Docs

- [`docs/tokens.md`](./docs/tokens.md) — every token, its raw Figma hex, the node
  it came from, and what is assumed rather than harvested.
- [`docs/api-contract.md`](./docs/api-contract.md) — backend endpoints and
  payloads. **Known inaccuracies:** the SSE payload is a bare `{status, message}`,
  not `TaskStatusResponse`; the pipeline has six stages, not the five the prose
  claims. `app/types/api.ts` mirrors the backend, not this document.
- [`docs/figma-node-map.md`](./docs/figma-node-map.md) — screen/section → Figma
  node IDs. Read design context at the **section** level; whole page frames
  truncate.
- [`RALPH.md`](./RALPH.md) — the build loop: wave backlog, verified findings from
  each wave, and the open questions still awaiting a decision.
