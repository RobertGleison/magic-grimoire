# Magic Grimoire

AI-powered Magic: The Gathering deck generator. Describe your dream deck in plain English — the system generates a balanced, playable 60-card deck using real MTG cards.

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
cp backend/.env.example backend/.env
# Fill in: DATABASE_URL, REDIS_URL, ANTHROPIC_API_KEY, SUPABASE_JWT_SECRET

# 3. Start all services
docker compose up
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
cd backend
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
cd frontend
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

Full documentation lives in [`docs/`](docs/) and is maintained as an Obsidian vault.
Open the repo root as a vault in Obsidian to browse it. See [`docs/obsidian-setup.md`](docs/obsidian-setup.md) for setup instructions.
