# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Update this file after completing any non-trivial task** (new app, new service, schema change, new command) so it stays accurate for the next session. Keep it terse — delete anything that becomes obvious from the code.

## Project

GRH-Auto — HR automation platform for an Algerian HR department. Everything runs local/self-hosted to comply with Loi 18/07 (personal data must not leave national territory): no cloud LLM (Ollama only), no n8n Cloud, no external DB sync. SMTP (Gmail) is the only permitted outbound network call.

Spec source of truth: `cahier_des_charges_grh_auto_v4_agile.docx` (root) — Agile/Scrum reformat of `cahier_des_charges_grh_auto_v3.docx` (kept for reference: route lists, endpoint tables, directory tree, post-MVP roadmap not restated in v4). Same scope, organized as 8 Epics (E1-E9), 34 User Stories, 254 story points, 8 one-week sprints. Sprint 1 (E1 Infra) and Sprint 2 (E2 Import Excel) are done; Sprint 3+ (E3 Automatisations, E4 Email, E5 Dashboard, E6 AI Agents, E7 n8n, E8 Temps réel/Logs, E9 Export/Polish) not started.

Note: v3/v4 assume a more granular Django app split (`imports`, `mails`, `llm`, `n8n_integration`, `notifications`, `dashboard`) than what currently exists (`core`, `employees`, `agents`, `integrations`, `automatisations`) — not fully reconciled, but `automatisations` now exists as its own app.

## Stack

- Backend: Django 5 + DRF + Strawberry GraphQL + Django Channels (WebSocket)
- Frontend: React 18 + Vite + Tailwind CSS v4 + React Query (TanStack) + Recharts
- DB: PostgreSQL 16
- Scheduler: APScheduler (`django-apscheduler`, jobs stored in DB)
- AI: Ollama (local LLM, runs on the host — NOT in Docker, see Conventions) + LangChain agents (Analyste, Assistant Chat, Orchestrateur — planned)
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
| Ollama   | http://localhost:11434 (runs on host, not in Docker) |

No test suite exists yet.

## Architecture

**Monorepo layout**: `backend/` (Django) + `frontend/` (React) + `n8n/workflows/` (exported n8n workflows) + `docker-compose.yml` at root. No shared packages between backend/frontend — communication is via REST/GraphQL/WebSocket only.

**Django apps** (`backend/`), each independent with its own `models.py`/`views.py`/`urls.py`/`admin.py`:
- `core` — shared/cross-cutting concerns: Excel import, mail generation/log, global config
- `employees` — HR domain data (the business entities)
- `agents` — LangChain/Ollama AI agents (analysis, chat assistant, orchestration) — currently just `agents/ollama_client.py`, the shared LLM client used by both `core` (manual mail preview) and `automatisations` (rule-driven alerts)
- `automatisations` — APScheduler-driven business rules: `RegleAutomatisation` (delays, department filter, recipients, prompt override) and `AlerteEnvoyee` (dedup guard so the same contract/delay/rule doesn't alert twice). `automatisations/services.py` has `evaluer_regles()` (checks all active rules against contracts nearing `date_fin`, generates+sends mail via Ollama+SMTP) and `generer_rapport_quotidien()` (daily digest of contracts expiring within 45 days + import count)
- `integrations` — everything that talks outward: APScheduler config (`integrations/scheduler.py`, registers `evaluer_regles` at 09:00 and `generer_rapport_quotidien` at 09:05 daily), WebSocket consumer for real-time notifications (`integrations/consumers.py` + `routing.py`), and (planned) n8n webhook endpoints

Each app still exposes a `GET /api/<app>/health/` placeholder endpoint alongside real ones as they land.

**Excel import (Phase 2)**: `core.models.ExcelImport` tracks each upload (status, row counts, per-row errors as JSON). `core.services.parse_employee_excel()` reads an `.xlsx` via openpyxl and upserts `employees.Employee` rows by `matricule`. Expected columns (case-insensitive, French accents normalized in `core.services.COLUMN_MAP`): `matricule`, `nom`, `prenom`, `email`, `departement`, `poste`, `date_embauche`. `POST /api/imports/upload/` (multipart, field `fichier`) runs the parse synchronously and returns the `ExcelImport` record; `GET /api/imports/historique/` lists past imports; `GET /api/employes/` lists employees (filters: `departement`, `actif`, `search`).

**employees app models**: `Employee` (matricule unique) and `Contract` (FK to Employee, `type` in CDI/CDD/STAGE/AUTRE, tracks `date_debut`/`date_fin` — queried by `automatisations.evaluer_regles()` for expiring-contract alerts).

**Mail generation (Phase 3)**: `agents/ollama_client.py` wraps the `ollama` Python client (`ollama.Client(host=settings.OLLAMA_BASE_URL)`), calling `settings.OLLAMA_MODEL` in chat mode with a system prompt that asks for a strict `SUJET:` / `CORPS:` format, parsed by `_parse_mail_response()`. `generate_mail_content(employee, sujet_demande, prompt_override=None)` returns `{"subject", "body"}` or raises `OllamaGenerationError`. `core.models.MailLog` records every generation attempt (DRAFT/SENT/FAILED, linked to `employee` and optionally `automatisations.RegleAutomatisation` via `regle`). `POST /api/mails/apercu/` (body: `employee_id`, `sujet_demande`, optional `prompt_override`) generates a draft without sending — used by the manual "aperçu mail" flow; `automatisations.services._envoyer_alerte()` does the generate-then-send version for rule-driven alerts. `GET /api/config/` exposes current Ollama/SMTP settings read-only (no DB-backed config yet).

Known quirk: the parsed `subject` sometimes contains a duplicated "SUJET :" prefix depending on how the model formats its response — cosmetic, not yet fixed.

**Email sending (Sprint 3, E4)**: also in `core`. `POST /api/mails/envoyer/` (body: `mail_log_id`, optional `subject`/`body` overrides) sends the given `MailLog`'s content — used after editing an `/apercu/` draft — updates `status`/`sent_at`/`erreur` via Django's `EmailMessage`. `GET /api/mails/historique/` lists `MailLog` rows, filterable by `statut`/`employee`/`date` query params. `POST /api/config/smtp/test/` opens+closes an SMTP connection via `django.core.mail.get_connection()` using `.env` creds, without sending mail — returns `{"status": "ok"}` or `{"status": "erreur", "detail": ...}` (400).

**Frontend pages**: `/automatisations` (rule list with run/test/delete, modal creation form), `/mails/apercu` (generate → edit → regenerate → send), `/mails/historique` (filterable send log + SMTP test button) — all under `frontend/src/pages/`, wired in `frontend/src/App.jsx`, API calls in `frontend/src/lib/api.js`.

**GraphQL**: single schema at `backend/config/schema.py`, mounted at `/graphql/` via `AsyncGraphQLView` in `config/urls.py`, wrapped in `csrf_exempt` (internal API, no cookie-based session auth in play). Only a `health` test field exists — no models are exposed via GraphQL yet. `strawberry_django` is intentionally NOT in `INSTALLED_APPS`: it was removed because the installed `strawberry-graphql-django==0.44.1` pulls in a `strawberry-graphql` version incompatible with `strawberry.auto` (`ModuleNotFoundError: No module named 'strawberry.auto'`) — pin compatible versions together before re-adding it.

**Media uploads**: `MEDIA_ROOT = backend/media/`, served via `MEDIA_URL = "media/"` — not committed to git (`media/` in `.gitignore`).

**ASGI/WebSocket**: `config/asgi.py` routes HTTP through Django's ASGI app and WebSocket through `integrations/routing.py` → `NotificationsConsumer`, which broadcasts to the `notifications` channel group via Django Channels (Redis-backed channel layer).

**Docker network**: services reference each other by service name (`db`, `redis`, `n8n`), not `localhost`, inside the Compose network — `.env` values like `POSTGRES_HOST=db` depend on this. Ollama is the exception (see Conventions below).

**n8n**: self-hosted only, backed by the same PostgreSQL instance (separate schema via `DB_TYPE=postgresdb` env vars in `docker-compose.yml`), workflows persisted to `n8n/workflows/`.

## Conventions

- Env config is read via `django-environ` from the root `.env` file (`backend/config/settings.py` points to `BASE_DIR.parent / ".env"`), not `backend/.env`.
- Locale is fixed to `fr-fr` / `Africa/Algiers` in Django settings.
- Tailwind v4 uses the new CSS-first config (`@import "tailwindcss"` in `index.css`, `@tailwindcss/postcss` plugin) — no `tailwind.config.js`.
- **Ollama runs on the host, not in Docker** (deliberately removed from `docker-compose.yml` — the containerized image + model pull consumed too much disk). The `backend` service reaches it via `OLLAMA_BASE_URL=http://host.docker.internal:11434` (set directly in `docker-compose.yml`'s `backend.environment`, overriding whatever is in `.env`), with `extra_hosts: host.docker.internal:host-gateway` so that resolves inside the container. Start Ollama locally (`ollama serve`, or the desktop app) before running the backend. `.env`'s `OLLAMA_MODEL` must match a model you've actually pulled locally (`ollama list` to check) — it currently is NOT `llama3` (the cahier des charges default) but whatever is set in `.env`, since `llama3` isn't pulled on the dev machine.
