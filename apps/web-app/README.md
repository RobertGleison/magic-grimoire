# Magic Grimoire — Web App

The frontend for Magic Grimoire: a Next.js 15 (App Router) + TypeScript client that lets a user describe a deck in plain language, watches it get built in real time over SSE, and renders the result as a browsable deck list.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Layout](#project-layout)
- [Auth Flow](#auth-flow)
- [Real-Time Progress (SSE)](#real-time-progress-sse)
- [Local Development](#local-development)
- [Testing](#testing)
- [Build & Deploy](#build--deploy)
- [Known Limitations](#known-limitations)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15.5 (App Router), React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 |
| Animation | Framer Motion |
| Auth | Supabase JS client (Google + GitHub OAuth, email/password) |
| Unit tests | Vitest + Testing Library |
| E2E tests | Playwright (+ axe-core for accessibility) |

---

## Project Layout

```
apps/web-app/app/
├── layout.tsx              # Root layout — fonts, UserProvider, SpineNav, AuthGate
├── page.tsx                 # Landing page ("/")
├── deck-builder/
│   └── page.tsx              # Core app screen ("/deck-builder") — chat + options + deck panel
├── library/
│   └── page.tsx              # Saved decks screen ("/library", auth-gated)
├── enums.ts                  # ManaColor / Format / Archetype / Strategy + color-toggle helpers
├── context/
│   └── UserContext.tsx        # Supabase session state, exposes useUser()
├── lib/
│   └── supabase.ts             # Lazy Supabase client singleton
├── hooks/
│   └── useAutoScroll.ts        # Horizontal auto-scroll loop (currently unused, see Known Limitations)
└── components/
    ├── ArcaneSigil/             # Animated hero SVG (landing page)
    ├── ArcaneSigilLogo/         # Logo + Ornament/Frame layout helpers
    ├── AuthGate/                # Mounts AuthModal when auth is requested
    ├── AuthModal/                # Login/signup dialog (email + OAuth)
    ├── ChatInput/                 # Prompt textarea, suggestion chips, send/stop controls
    ├── ChatMessage/               # One chat bubble (user or oracle), lightweight markdown
    ├── DeckPanel/                 # Generated-deck viewer: grouping, mana curve, export, card preview
    ├── ManaSymbol/                # Mana pip / cost renderer
    ├── NavBar/                    # SpineNav — top nav, auth-aware links
    ├── OptionsPanel/              # Format / colors / deck-size controls
    ├── PromptCarousel/            # Swipeable example-prompt carousel (currently unused)
    └── Toast/                     # One-time localStorage-gated dev notice
```

### Routes

| Route | Purpose |
|---|---|
| `/` | Marketing landing page — hero, how-it-works, features, example-prompt marquee, CTA. |
| `/deck-builder` | The main app: chat with the Grimoire, set format/colors/deck size, watch generation progress, browse the result. Redirects guests to `/` and opens the auth modal. |
| `/library` | Saved decks. **Currently backed by a hardcoded example list**, not a real backend fetch — see [Known Limitations](#known-limitations). |

---

## Auth Flow

- `app/lib/supabase.ts` lazily builds a singleton Supabase client from `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — lazy on purpose, so `createClient` never runs during SSR/prerendering.
- `UserProvider` (`app/context/UserContext.tsx`) wraps the whole app in the root layout. It loads `supabase.auth.getSession()` on mount and subscribes to `onAuthStateChange`, exposing `user`, `token` (the Supabase JWT), `ready`, `signOut`, and the global `authOpen`/`openAuth`/`closeAuth` controls via `useUser()`.
- `AuthModal` handles both email/password (`signInWithPassword` / `signUp`) and OAuth (`signInWithOAuth({ provider: 'google' | 'github' })`); `AuthGate` just mounts it when `authOpen` is true.
- The deck-builder page reads `token` from `useUser()` and attaches it as `Authorization: Bearer <token>` on its REST calls (`POST /api/v1/chat`, `POST /api/v1/decks/generate`, `GET /api/v1/decks/:id`).
- **The SSE connection is not authenticated** — native `EventSource` can't set custom headers, so the JWT isn't attached to `GET /api/v1/tasks/:id/stream`. Access control for that endpoint currently relies on the caller knowing the `task_id`, not on the bearer token.

---

## Real-Time Progress (SSE)

All of this lives in `app/deck-builder/page.tsx`, in `handleGenerateDeck`:

1. `POST /api/v1/decks/generate` with `{ prompt, format, colors, deck_size }` returns `{ task_id, deck_id }`. A `429` means the guest's one free build is used up — the UI opens the auth modal.
2. `new EventSource('/api/v1/tasks/${task_id}/stream')` opens the progress stream.
3. Each message is parsed as `{ status }` and mapped through a fixed `STATUS_TO_STAGE` table to one of four stages — *parsing intent → searching cards → composing deck → enriching* — driving an animated progress UI in place of the assistant's chat bubble.
4. `status === 'completed'` closes the stream and calls `GET /api/v1/decks/:id` to populate the `DeckPanel`. `status === 'failed'` closes the stream and shows an error message. Unparseable messages (e.g. SSE keepalive comments) are silently ignored.
5. `onerror` (dropped connection) falls back to fetching the deck anyway, unless the user has clicked **Stop**.

In dev, `next.config.ts` rewrites `/api/:path*` → `http://localhost:8000/api/:path*`, so the Next.js dev server proxies every `/api/v1/...` call — including the SSE stream — to the locally running backend.

---

## Local Development

```bash
cd apps/web-app
npm install

# Create apps/web-app/.env.local with:
#   NEXT_PUBLIC_SUPABASE_URL=<your Supabase project URL>
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your Supabase anon key>

npm run dev
```

The backend (FastAPI + Postgres + Redis) needs to be running separately — see the root [`README.md`](../../README.md) or [`apps/api-server/README.md`](../api-server/README.md). There is no Docker service for the frontend; it's meant to run locally via `npm run dev` alongside `docker compose up` for the backend (see [Known Limitations](#known-limitations)).

**Lint:** `npm run lint`
**Build:** `npm run build`

---

## Testing

```bash
npm run test:unit       # Vitest — tests/unit/**/*.test.{ts,tsx}
npm run test:e2e        # Playwright — tests/**/*.spec.ts (auto-starts npm run dev)
npm test                # both, in sequence
```

- **Unit tests** (`tests/unit/`) cover `enums.ts` color logic, `ManaSymbol`, `NavBar`, `OptionsPanel`, and `AuthModal`/`AuthGate`.
- **E2E tests** (`tests/*.spec.ts`) cover the landing page (hero CTA, sections present, axe accessibility scan) and the nav bar (link visibility, active state, login/logout).

⚠️ **The unit suite currently has real failures, not flakes** — several tests were written against an older component API and no longer match the code (e.g. `AuthModal.test.tsx` imports `AuthModal`/`AuthGate` as default exports, but both are named exports only; it also asserts on copy/props that no longer exist). Don't treat a green `npm test` run as validation until these are reconciled with the current components.

---

## Build & Deploy

There's no Dockerfile for this app and no `web-app` service in the root `docker-compose.yml` — only `postgres`, `redis`, `ollama`, `api`, and `worker` are containerized. `make dev` (repo root) starts those via Docker Compose and then runs `npm run dev` in the foreground for the frontend. `make build` runs `npm run build`.

---

## Known Limitations

- **`/library` isn't wired to the backend yet** — it renders a hardcoded example deck list plus client-side `.txt` import; there's no fetch to a "list my decks" endpoint, and multi-select/bulk-remove is client-state only (not persisted).
- **Dead code**: `PromptCarousel` and `useAutoScroll` are not imported anywhere — the landing page implements its own marquee scroll instead.
- **Stale unit tests** — see [Testing](#testing).
