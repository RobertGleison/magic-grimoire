# Magic Grimoire

Whisper your desire into the tome — Magic Grimoire translates a plain-language description into a complete, balanced Magic: The Gathering deck.

Type something like *"aggressive mono-red burn for Modern"* or *"five-color dragon Commander deck helmed by The Ur-Dragon"* and the system handles the rest: it parses your intent with Claude, searches Scryfall's database of 17,000+ cards, composes a synergistic 60-card list with a proper mana curve, and streams every step back to you in real time.

**Key features:**
- Natural language input — no card names, no set codes, just intent
- Supports Standard, Modern, Pioneer, Legacy, and Commander
- Real-time progress via SSE (intent parsing → card search → composition → enrichment)
- Authenticated users can save decks to their personal library and export to Arena format
- Arcane-themed UI with split-screen chat and deck panel

---

## Prerequisites

- [Docker](https://www.docker.com/) + Docker Compose
- [Node.js 20+](https://nodejs.org/) (for local frontend dev)
- [uv](https://docs.astral.sh/uv/) (for local backend dev)

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/RobertGleison/magic-grimoire.git
cd magic-grimoire

# 2. Set up environment variables
cp apps/api-server/.env.dev apps/api-server/.env
# Fill in: ANTHROPIC_API_KEY (if using LLM_PROVIDER=claude), SUPABASE_JWT_SECRET

# Frontend auth needs its own env file — create apps/web-app/.env.local with:
#   NEXT_PUBLIC_SUPABASE_URL=<your Supabase project URL>
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your Supabase anon key>

# 3. Start all services
make dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Flower (task monitor) | http://localhost:5555 |

---

## Local Development

### Backend

```bash
cd apps/api-server
uv sync
uv run uvicorn app.main:app --reload
```

**Run tests:**
```bash
uv run pytest
```

**Run migrations:**
```bash
uv run alembic upgrade head
```

**Create a new migration:**
```bash
uv run alembic revision --autogenerate -m "description"
```

### Frontend

```bash
cd apps/web-app
npm install
npm run dev
```

**Lint:**
```bash
npm run lint
```

**Build:**
```bash
npm run build
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS 4 |
| Auth | Supabase Auth (Google + GitHub OAuth) |
| Backend | FastAPI, Python 3.13 |
| Task Queue | Celery 5 + Redis |
| Database | PostgreSQL 16 + SQLAlchemy 2 |
| AI | Anthropic Claude API |
| Card Data | Scryfall API |

---

## Documentation

- **Backend** — [`apps/api-server/README.md`](apps/api-server/README.md): architecture diagrams, the full deck-generation pipeline walkthrough, DI patterns, session lifecycle, and a worked request/response example.
- **Frontend** — [`apps/web-app/README.md`](apps/web-app/README.md): routes, components, the Supabase auth flow, and how SSE progress is consumed.
- Full living documentation lives in [`docs/`](docs/) and is maintained as an Obsidian vault. Open the repo root as a vault in Obsidian to browse it. See [`docs/obsidian-setup.md`](docs/obsidian-setup.md) for setup instructions.
