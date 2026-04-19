---
tags: [adr]
status: Accepted
created: 2026-04-19
---

# ADR-0003: Monorepo Directory Structure

## Status

`Accepted`

## Context

Magic Grimoire is a monorepo with two apps — a Python/FastAPI backend and a Next.js frontend — currently living at `backend/` and `frontend/` in the repo root. These names describe the technical role of each app, not what the app *is*. As the project grows to potentially include a React Native mobile app and a Discord bot, the flat `backend/`/`frontend/` split does not scale: new apps have no natural home, there is no shared tooling layer, and the structure does not signal "this is a multi-app monorepo" to contributors or tooling.

## Decision Drivers

- **Future apps are plausible:** A React Native/Expo mobile app and a Discord bot (`discord.js`) are on the roadmap. Both are Node/TypeScript apps that belong alongside `web-app` under a common `apps/` namespace.
- **Convention over description:** `apps/api-server` and `apps/web-app` name what the app *is*; `backend/` and `frontend/` name what it *does*. The former scales to many apps; the latter breaks down past two.
- **Unified entry point:** A root `Makefile` should be the single place to run `make dev`, `make test`, `make build` — regardless of which app or language is involved.
- **Minimal tooling overhead:** The project is personal/portfolio scale. Full monorepo orchestrators (Turborepo, Nx) are overkill. A root `package.json` with npm workspaces is sufficient and Turborepo-compatible if needed later.
- **No shared Node packages yet:** The frontend calls the backend API directly; no generated API types or shared packages are needed now. The `packages/` directory is created as an empty placeholder.

## Considered Options

| Option | Pros | Cons |
|---|---|---|
| **A. Pure rename + Makefile** | Zero added complexity, minimal migration | No workspace foundation for future Node apps; ESLint/TS configs would duplicate across apps |
| **B. Rename + Makefile + npm workspaces** ✅ | Workspace structure ready for mobile/bot apps; shared tooling configs possible; Turborepo-compatible; costs ~10 lines today | Root `package.json` adds minor confusion; Expo needs extra Metro config when mobile is added |
| **C. Rename + Makefile + Turborepo** | Build caching, parallelism, dependency graph | Overkill for 2 apps; Python support is bolted-on; Expo has its own build system (EAS), creating two orchestrators |

## Decision

**Chosen option: B — `apps/` namespace with root Makefile and npm workspaces.**

The repository is restructured from a flat `backend/`/`frontend/` layout to an `apps/`-namespaced structure with a root `Makefile` as the unified command entry point and a root `package.json` declaring npm workspaces. A `packages/` directory is created as an empty placeholder for future shared Node packages (shared ESLint config, TypeScript base config). This structure was chosen because future Node apps (React Native mobile, Discord bot) are plausible additions and the workspace foundation costs almost nothing to establish now — avoiding a second structural refactor later.

## Target Structure

```
magic-grimoire/
├── apps/
│   ├── api-server/          ← was backend/ (FastAPI + Celery, Python 3.13)
│   └── web-app/             ← was frontend/ (Next.js 15, TypeScript)
├── packages/                ← empty now; future: shared ESLint config, TS base, etc.
├── docs/
├── .github/workflows/
├── docker-compose.yml       ← unchanged, references new paths
├── Makefile                 ← new root entry point
└── package.json             ← new: workspaces declaration
```

### Root `package.json`

```json
{
  "name": "magic-grimoire",
  "private": true,
  "workspaces": ["apps/web-app", "packages/*"]
}
```

### Root `Makefile` (representative targets)

```makefile
.PHONY: dev build test lint

dev:
	docker-compose up

build:
	cd apps/web-app && npm run build

test:
	cd apps/api-server && uv run pytest
	cd apps/web-app && npm test

lint:
	cd apps/api-server && uv run ruff check .
	cd apps/web-app && npm run lint
```

### Paths to update after restructure

| File | Change |
|---|---|
| `docker-compose.yml` | Build contexts: `./backend` → `./apps/api-server`, `./frontend` → `./apps/web-app` |
| `.github/workflows/backend.yml` | Working directory: `backend/` → `apps/api-server/` |
| `.github/workflows/frontend.yml` | Working directory: `frontend/` → `apps/web-app/` |
| `apps/web-app/next.config.ts` | No change needed (internal paths unaffected) |
| `CLAUDE.md` | Update repo layout section |

### Future app placement

| App | Path | Notes |
|---|---|---|
| React Native / Expo | `apps/mobile/` | Needs `metro.config.js` with `watchFolders: [repoRoot]` for workspace symlink resolution |
| Discord bot | `apps/discord-bot/` | Standard Node app; add to workspaces array |
| Shared ESLint config | `packages/eslint-config/` | Consumed by `apps/web-app`, `apps/mobile`, `apps/discord-bot` |
| Shared TS base | `packages/tsconfig/` | `base.json` extended by each app's `tsconfig.json` |

## Consequences

### Positive
- New Node apps have a clear, conventional home under `apps/`
- Root `Makefile` is the single command entry point regardless of language
- npm workspaces foundation eliminates a future structural refactor when mobile/bot is added
- Structure is immediately recognisable to contributors familiar with monorepos (Turborepo, pnpm workspaces use the same shape)

### Negative
- Two `package.json` files exist (root + `apps/web-app`) — minor source of confusion
- `npm install` from the root installs `web-app` dependencies (not harmful, just implicit)
- Python app (`api-server`) is outside the Node workspace and must be managed separately via `uv`

### Risks
- **Expo monorepo friction:** Metro bundler requires explicit `watchFolders` configuration to resolve workspace symlinks. Mitigation: document the required `metro.config.js` in `apps/mobile/` when the app is scaffolded.
- **CI path drift:** Workflows that hardcode `backend/` or `frontend/` paths will break silently if not updated. Mitigation: update all three workflows as part of the same PR as the rename.

## Related

- [[adr/ADR-0001-tech-stack-selection|ADR-0001: Tech Stack Selection]]
- [[adr/ADR-0002-redis-celery-implementation|ADR-0002: Redis & Celery Implementation Strategy]] — Docker Compose worker service definitions (`ai`, `scryfall`, `default`, `dead_letter`) depend on the `apps/api-server/` build context updated by this ADR
- [[adr/index]]
- [[Home]]
