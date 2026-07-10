# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Update this file after completing any non-trivial task** (new app, new service, schema change, new command) so it stays accurate for the next session. Keep it terse — delete anything that becomes obvious from the code.

## Project

GRH-Auto — HR automation platform for an Algerian HR department. Everything runs local/self-hosted to comply with Loi 18/07 (personal data must not leave national territory): no cloud LLM (Ollama only), no n8n Cloud, no external DB sync. SMTP (Gmail) is the only permitted outbound network call.

Spec source of truth: `cahier_des_charges_grh_auto_v3.docx` (root).

## Stack

- Backend: Django 5 + DRF + Strawberry GraphQL + Django Channels (WebSocket)
- Frontend: React 18 + Vite + Tailwind CSS v4 + React Query (TanStack) + Recharts
- DB: PostgreSQL 16
- Scheduler: APScheduler (`django-apscheduler`, jobs stored in DB)
- AI: Ollama (local LLM) + LangChain agents (Analyste, Assistant Chat, Orchestrateur — planned)
- Visual workflows: n8n Self-Hosted (excluded: n8n Cloud)
- Orchestration: Docker Compose

## Commands

```bash
cp .env.example .env          # first-time setup, then edit secrets
docker compose up --build     # start all services
docker compose build backend  # rebuild backend image only
docker compose build frontend # rebuild frontend image only

# Django (inside backend container, or locally with venv + requirements.txt)
python manage.py migrate
python manage.py createsuperuser
python manage.py makemigrations <app>

# Frontend (inside frontend/, requires npm install first)
npm run dev
npm run build
npm run lint
```

Services once running:

| Service  | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:8000 |
| GraphQL  | http://localhost:8000/graphql/ |
| n8n      | http://localhost:5678 |
| Ollama   | http://localhost:11434 |

No test suite exists yet (Phase 1 was scaffolding only).

## Architecture

**Monorepo layout**: `backend/` (Django) + `frontend/` (React) + `n8n/workflows/` (exported n8n workflows) + `docker-compose.yml` at root. No shared packages between backend/frontend — communication is via REST/GraphQL/WebSocket only.

**Django apps** (`backend/`), each independent with its own `models.py`/`views.py`/`urls.py`/`admin.py`:
- `core` — shared/cross-cutting concerns
- `employees` — HR domain data (the business entities)
- `agents` — LangChain/Ollama AI agents (analysis, chat assistant, orchestration)
- `integrations` — everything that talks outward: APScheduler config (`integrations/scheduler.py`), WebSocket consumer for real-time notifications (`integrations/consumers.py` + `routing.py`), and (planned) n8n webhook endpoints

Each app currently exposes a `GET /api/<app>/health/` placeholder endpoint — replace with real endpoints as features land.

**GraphQL**: single schema at `backend/config/schema.py`, mounted at `/graphql/` via `AsyncGraphQLView` in `config/urls.py`. `strawberry_django` is installed for future model-bound types but not yet wired to any model.

**ASGI/WebSocket**: `config/asgi.py` routes HTTP through Django's ASGI app and WebSocket through `integrations/routing.py` → `NotificationsConsumer`, which broadcasts to the `notifications` channel group via Django Channels (Redis-backed channel layer).

**Docker network**: services reference each other by service name (`db`, `redis`, `ollama`, `n8n`), not `localhost`, inside the Compose network — `.env` values like `POSTGRES_HOST=db` and `OLLAMA_BASE_URL=http://ollama:11434` depend on this.

**n8n**: self-hosted only, backed by the same PostgreSQL instance (separate schema via `DB_TYPE=postgresdb` env vars in `docker-compose.yml`), workflows persisted to `n8n/workflows/`.

## Conventions

- Env config is read via `django-environ` from the root `.env` file (`backend/config/settings.py` points to `BASE_DIR.parent / ".env"`), not `backend/.env`.
- Locale is fixed to `fr-fr` / `Africa/Algiers` in Django settings.
- Tailwind v4 uses the new CSS-first config (`@import "tailwindcss"` in `index.css`, `@tailwindcss/postcss` plugin) — no `tailwind.config.js`.
