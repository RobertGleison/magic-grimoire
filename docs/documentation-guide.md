# docs/CLAUDE.md — Documentation Subagent

Instructions for AI working inside the `docs/` knowledge base.

---

## Purpose of this folder

`docs/` is an Obsidian vault (vault root = repo root, config at `.obsidian/`). All notes are plain markdown. Obsidian picks up any file written here instantly — no sync or API needed.

---

## How to generate a doc for a source file

When the user says **"document [file]"** or **"create documentation for [file]"**:

1. **Read the file** in full.
2. **Determine the output folder and tag** from the file path:

   | Source path | Output folder | Tag |
   |---|---|---|
   | `backend/app/services/*.py` | `docs/services/` | `#service` |
   | `backend/app/*/routes.py` | `docs/api/` | `#api` |
   | `backend/app/*/model.py` | `docs/models/` | `#model` |
   | `backend/app/*/worker.py` | `docs/workers/` | `#worker` |
   | `frontend/app/components/**` | `docs/frontend/components/` | `#frontend` |
   | `frontend/app/hooks/**` | `docs/frontend/hooks/` | `#frontend` |
   | `frontend/app/**/page.tsx` | `docs/frontend/pages/` | `#frontend` |
   | `.github/workflows/*.yml` | `docs/infrastructure/` | `#infrastructure` |
   | `docker-compose.yml` / k8s | `docs/infrastructure/` | `#infrastructure` |

3. **Generate the markdown note** with this structure:

   ```markdown
   ---
   tags: [<tag>]
   source: <relative path from repo root>
   created: <YYYY-MM-DD>
   ---

   # <Human-readable title>

   > One-sentence description.

   ## Overview

   2–4 sentences on purpose and role in the system.

   ## Key Responsibilities

   - bullet list

   ## Public Interface

   Table of exported functions/classes/endpoints.

   ## Dependencies

   | Dependency | Purpose |
   |---|---|
   | [[linked-note]] | why |

   ## Related

   - [[Home]]
   ```

4. **Save** to the output folder with a kebab-case filename (e.g. `claude_service.py` → `docs/services/claude-service.md`).
5. **Update `docs/Home.md`** — add a wikilink under the correct section.

---

## Conventions

- Filenames: kebab-case, `.md`
- Cross-references: always Obsidian wikilinks `[[note-name]]`, never markdown links
- Every note must have `tags`, `source`, `created` frontmatter
- Every note links back to `[[Home]]` in its Related section
- When a doc already exists, update it — do not recreate it

---

## ADR workflow

ADRs live in `docs/adr/`. Use the `/adr` skill to create them interactively.
- Index: `docs/adr/index.md` — update the Records table after every new ADR
- Naming: `ADR-{id}-{kebab-title}.md`, IDs are zero-padded 4-digit numbers

---

## Folder map

```
docs/
├── CLAUDE.md           ← you are here
├── Home.md             ← index note, links to everything
├── adr/                ← Architecture Decision Records
├── services/           ← backend service docs
├── api/                ← API route docs
├── models/             ← database model docs
├── workers/            ← Celery worker docs
├── frontend/
│   ├── components/
│   ├── hooks/
│   └── pages/
├── infrastructure/     ← Docker, K8s, CI
└── _templates/         ← note templates (not linked in graph)
```
