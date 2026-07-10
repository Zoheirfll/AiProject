# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Update this file after completing any non-trivial task** (new app, new service, schema change, new command) so it stays accurate for the next session. Keep it terse — delete anything that becomes obvious from the code.

## Project

GRH-Auto — HR automation platform for an Algerian HR department. Everything runs local/self-hosted to comply with Loi 18/07 (personal data must not leave national territory): no cloud LLM (Ollama only), no n8n Cloud, no external DB sync. SMTP (Gmail) is the only permitted outbound network call.

Spec source of truth: `cahier_des_charges_grh_auto_v4_agile.docx` (root) — Agile/Scrum reformat of `cahier_des_charges_grh_auto_v3.docx` (kept for reference: route lists, endpoint tables, directory tree, post-MVP roadmap not restated in v4). Same scope, organized as 8 Epics (E1-E9), 34 User Stories, 254 story points, 8 one-week sprints. Sprint 1 (E1 Infra) and Sprint 2 (E2 Import Excel) are done; Sprint 3 (E3 Automatisations, E4 Email) is done and extended beyond spec (see below); E5 Dashboard, E6 AI Agents, E7 n8n, E8 Temps réel/Logs, E9 Export/Polish not started.

Note: v3/v4 assume a more granular Django app split (`imports`, `mails`, `llm`, `n8n_integration`, `notifications`, `dashboard`) than what currently exists — `automatisations` was split out in Sprint 3; mail sending stayed in `core` (`MailLog`) rather than a separate `mails` app since it predates this reconciliation. Not fully reconciled yet.

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
python manage.py test               # full backend suite (38 tests as of Sprint 3)
python manage.py test <app>         # single app

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

Django's built-in test runner is used (`manage.py test`) — no pytest is installed, don't add it.

## Architecture

**Monorepo layout**: `backend/` (Django) + `frontend/` (React) + `n8n/workflows/` (exported n8n workflows) + `docker-compose.yml` at root. No shared packages between backend/frontend — communication is via REST/GraphQL/WebSocket only.

**Django apps** (`backend/`), each independent with its own `models.py`/`views.py`/`urls.py`/`admin.py`:
- `core` — shared/cross-cutting concerns: Excel import, mail generation/log, global config
- `employees` — HR domain data (the business entities)
- `agents` — LangChain/Ollama AI agents (analysis, chat assistant, orchestration) — currently just `agents/ollama_client.py`, the shared LLM client used by `core` (manual/bulk mail preview), `automatisations` (rule-driven alerts and document-surveillance analysis)
- `automatisations` — APScheduler-driven business rules, two independent mechanisms:
  - **Contract-expiry alerts**: `RegleAutomatisation` (delays, department filter, recipients, prompt override) and `AlerteEnvoyee` (dedup guard so the same contract/delay/rule doesn't alert twice). `evaluer_regles()` checks all active rules against contracts nearing `date_fin`, generates+sends mail via Ollama+SMTP; `generer_rapport_quotidien()` sends a daily digest (contracts expiring within 45 days + import count).
  - **Generic document surveillance** (n8n-style): `TacheSurveillance` (watches one uploaded document — Excel/CSV/text — on an hourly or daily-at-a-time schedule, holds a free-text `prompt_analyse` instruction and a `mode_envoi` of TOUJOURS/ANOMALIE) and `ExecutionSurveillance` (audit log of every run, sent or not). `evaluer_taches_surveillance()` is the scheduler tick (every 5 min) that runs whatever task is due; `_executer_tache()` reads the file, calls `agents.ollama_client.analyser_document()` (asks Ollama to decide ENVOYER OUI/NON + draft SUJET/CORPS), and emails the resolved recipients only if warranted (or always, if TOUJOURS).
  - Both mechanisms share `_resoudre_liste()` for recipients: plain emails, `"departement:X"` (all active employees in that department), or `"tous"` (all active employees) — the last alias is surveillance-only in practice but works for `RegleAutomatisation` too.
- `integrations` — everything that talks outward: APScheduler config (`integrations/scheduler.py` — registers `evaluer_regles` at 09:00, `generer_rapport_quotidien` at 09:05, `evaluer_taches_surveillance` every 5 minutes, `scan_dossier_surveille` every 45s), WebSocket consumer for real-time notifications (`integrations/consumers.py` + `routing.py`), `integrations/notifications.py` (`notify(payload)` — sync helper wrapping `channel_layer.group_send` so non-async code, e.g. scheduler jobs, can push to the `notifications` WS group), and (planned) n8n webhook endpoints

Each app still exposes a `GET /api/<app>/health/` placeholder endpoint alongside real ones as they land.

**Excel import (Phase 2 + E2 completion)**: `core.models.ExcelImport` tracks each upload (status, row counts, per-row errors as JSON, plus `nom_fichier_origine` and `source` UPLOAD/DOSSIER). `core.services.parse_employee_excel(file_obj, mapping_override=None)` reads an `.xlsx` via openpyxl and upserts `employees.Employee` rows by `matricule`; dates go through `_coerce_date()` (accepts `dd/mm/yyyy`, `yyyy-mm-dd`, `dd-mm-yyyy`, raises a French `ValueError` otherwise, surfaced as a per-row error). Columns are resolved by `build_field_map()`: if `mapping_override` (a `{system_field: excel_column_header}` dict) is given it wins outright; otherwise falls back to the hardcoded alias table `core.services.COLUMN_MAP`. System fields: `matricule`, `nom`, `prenom`, `email`, `departement`, `poste`, `categorie`, `num_contrat`, `date_embauche`, `date_fin_contrat` (the last four added in the E2 completion pass — `categorie`/`num_contrat`/`date_fin_contrat` now live directly on `Employee`, not `Contract`).
- `core.models.ImportConfig` is a singleton (`ImportConfig.get_solo()`, pk=1) holding the reusable column `mapping` and the `dossier_surveille` watched-folder path — edited via `GET/PUT /api/imports/mapping/`.
- `core.services.scan_dossier_surveille()` is the scheduler tick (every 45s, see `integrations/scheduler.py`): scans `dossier_surveille` for new `.xlsx`/`.xls` files, imports each via `parse_employee_excel()` using the saved mapping, moves the source file into a `processed/` subfolder, and pushes a WebSocket notification via `integrations.notifications.notify()`.
- `POST /api/imports/upload/` (multipart, field `fichier`) runs the parse synchronously (using the saved mapping if one exists) and returns the `ExcelImport` record; `GET /api/imports/historique/` lists past imports; `DELETE /api/imports/<id>/` removes one. `GET /api/employes/` lists employees, now paginated (`EmployeePagination`, default page size 25, `page_size` query param) with filters `departement`, `categorie`, `type_contrat` (CDI/CDD/STAGE/AUTRE, matches related `Contract.type`), `actif`, `search`, and `ordering` (any of `matricule`/`nom`/`prenom`/`departement`/`poste`/`categorie`, prefix `-` for descending). `frontend/src/lib/api.js`'s `fetchEmployees()` (unpaginated call sites — dashboard chart, mail-preview picker) requests `page_size=1000` and unwraps `.results` to stay a plain array; `fetchEmployeesPage()` returns the raw paginated shape for the Imports page's employee table (filters/sort/pagination UI).
- Status logic: `SUCCESS` only if rows were actually imported, or the file was genuinely empty with zero errors — a `total==0` result caused by missing required columns (or an unreadable file) is `FAILED`, not `SUCCESS` (fixed a bug where column-mapping errors displayed as false successes).

**employees app models**: `Employee` (matricule unique; also holds `categorie`, `num_contrat`, `date_fin_contrat` — added for the E2 column-mapping story, distinct from `Contract.date_fin`) and `Contract` (FK to Employee, `type` in CDI/CDD/STAGE/AUTRE, tracks `date_debut`/`date_fin` — queried by `automatisations.evaluer_regles()` for expiring-contract alerts).

**Mail generation (Phase 3 + Sprint 3 extensions)**: `agents/ollama_client.py` wraps the `ollama` Python client (`ollama.Client(host=settings.OLLAMA_BASE_URL)`).
- `generate_mail_content(contact, sujet_demande, prompt_override=None)` — `contact` needs `.prenom`/`.nom`/`.poste`/`.departement` (an `Employee`, or a `SimpleNamespace` for ad-hoc recipients with no `Employee` record). Returns `{"subject", "body"}` or raises `OllamaGenerationError`. System prompt asks for strict `SUJET:`/`CORPS:` format, parsed by `_parse_mail_response()`.
- `analyser_document(prompt_analyse, contenu, forcer_envoi=False)` — generic document-analysis variant used by `TacheSurveillance`. Asks Ollama for `ENVOYER: OUI/NON` + `SUJET:`/`CORPS:`; `forcer_envoi=True` overrides the model's decision to always True (used for TOUJOURS-mode digests). Returns `{"envoyer", "subject", "body"}`.

`core.models.MailLog` records every generation attempt (DRAFT/SENT/FAILED). Recipient is either an `employee` FK **or** ad-hoc `destinataire_nom`/`destinataire_email` fields (no `Employee` record required) — `email_destinataire`/`nom_destinataire` properties resolve whichever source applies. Optionally linked to `automatisations.RegleAutomatisation` via `regle`.

- `POST /api/mails/apercu/` (body: `employee_id` **or** `destinataire_nom`+`destinataire_email`, `sujet_demande`, optional `prompt_override`) generates a draft without sending.
- `POST /api/mails/apercu-masse/` (multipart: `fichier` .xlsx with columns `email`/`nom`/`sujet`, optional `sujet_demande` as fallback subject) generates one draft per row — `core.services.parse_mail_masse_excel()` parses the sheet.
- `POST /api/mails/envoyer/` (body: `mail_log_id`, optional `subject`/`body` overrides) sends one previewed draft.
- `POST /api/mails/envoyer-masse/` (body: `mails: [{mail_log_id, subject?, body?}, ...]`) sends a batch of drafts.
- `GET /api/mails/historique/` lists `MailLog` rows (filters: `statut`, `employee`, `date`).
- `POST /api/config/smtp/test/` opens+closes an SMTP connection via `django.core.mail.get_connection()` using `.env` creds, without sending mail.
- `automatisations.services._envoyer_alerte()` / `_executer_tache()` do the generate-then-send version for rule-driven and surveillance-driven sends respectively.

Gmail SMTP requires an **App Password** (not the account password) when 2FA is enabled — `535 Username and Password not accepted` means `.env`'s `EMAIL_HOST_PASSWORD` is a regular password, not one from https://myaccount.google.com/apppasswords.

Known quirk: the parsed `subject` sometimes contains a duplicated "SUJET :" prefix depending on how the model formats its response — cosmetic, not yet fixed.

**Frontend pages** (`frontend/src/pages/`, wired in `frontend/src/App.jsx`, API calls in `frontend/src/lib/api.js`):
- `/imports` — upload card (real upload-progress bar + success/failure toast), a mapping/watched-folder config panel, filename+source+expandable-error-detail+delete import history table, and a filterable/sortable/paginated employee table (search, département, catégorie, type de contrat).
- `/automatisations` — `RegleAutomatisation` list with run/test/delete, modal creation form.
- `/surveillance` — `TacheSurveillance` list (file upload, frequency/time, analysis prompt, TOUJOURS/ANOMALIE mode) with run/test/delete and a per-task execution-history modal.
- `/mails/apercu` — three modes via a toggle: **Employé existant** (pick from imported employees), **Adresse libre** (ad-hoc nom+email, no `Employee` needed), **Excel (envoi en masse)** (upload a sheet, review/edit each generated draft, "Envoyer tout"). All three end in generate → edit → regenerate → send.
- `/mails/historique` — filterable send log + SMTP test button.

**Design system**: `frontend/src/theme.js` (color tokens, status-tone mapping, chart palette — single source of truth, mirrored into Tailwind's `@theme` block in `index.css`) + `frontend/src/lib/ui.jsx` (reusable primitives: `Card`, `Button`, `Badge`, `Modal`, `Field`, `Input`/`Textarea`/`Select`, `Toast`, `EmptyState`, `Spinner`, inline icon set — no external icon library). Sidebar layout (not a top navbar). Dark mode via Tailwind v4's `@custom-variant dark (&:where(.dark, .dark *))` in `index.css` + `frontend/src/lib/useTheme.js` (toggles a `.dark` class on `<html>`, persists to `localStorage`, defaults to OS preference) — toggle button lives in the sidebar header.

**GraphQL**: single schema at `backend/config/schema.py`, mounted at `/graphql/` via `AsyncGraphQLView` in `config/urls.py`, wrapped in `csrf_exempt` (internal API, no cookie-based session auth in play). Only a `health` test field exists — no models are exposed via GraphQL yet. `strawberry_django` is intentionally NOT in `INSTALLED_APPS`: it was removed because the installed `strawberry-graphql-django==0.44.1` pulls in a `strawberry-graphql` version incompatible with `strawberry.auto` (`ModuleNotFoundError: No module named 'strawberry.auto'`) — pin compatible versions together before re-adding it.

**Media uploads**: `MEDIA_ROOT = backend/media/`, served via `MEDIA_URL = "media/"` — not committed to git (`media/` in `.gitignore`). Includes `imports/` (employee Excel uploads) and `surveillance/` (`TacheSurveillance.fichier`, re-read on every scheduled run).

**ASGI/WebSocket**: `config/asgi.py` routes HTTP through Django's ASGI app and WebSocket through `integrations/routing.py` → `NotificationsConsumer`, which broadcasts to the `notifications` channel group via Django Channels (Redis-backed channel layer).

**Docker network**: services reference each other by service name (`db`, `redis`, `n8n`), not `localhost`, inside the Compose network — `.env` values like `POSTGRES_HOST=db` depend on this. Ollama is the exception (see Conventions below).

**n8n**: self-hosted only, backed by the same PostgreSQL instance (separate schema via `DB_TYPE=postgresdb` env vars in `docker-compose.yml`), workflows persisted to `n8n/workflows/`.

## Conventions

- Env config is read via `django-environ` from the root `.env` file (`backend/config/settings/base.py` points to `BASE_DIR.parent / ".env"`), not `backend/.env`.
- **Settings are split by environment**: `backend/config/settings/{base,dev,prod}.py` (not a single `settings.py`). `dev.py` reads `DJANGO_DEBUG`/`DJANGO_ALLOWED_HOSTS` from `.env` with permissive defaults; `prod.py` forces `DEBUG=False`, requires `DJANGO_ALLOWED_HOSTS` explicitly (no default — raises if unset), and enables secure cookie flags. `manage.py`/`wsgi.py`/`asgi.py` all default `DJANGO_SETTINGS_MODULE` to `config.settings.dev`; override it (env var or `docker-compose.yml`) to run against `prod`.
- Locale is fixed to `fr-fr` / `Africa/Algiers` in Django settings.
- Tailwind v4 uses the new CSS-first config (`@import "tailwindcss"` in `index.css`, `@tailwindcss/postcss` plugin) — no `tailwind.config.js`. Custom tokens/dark-mode variant also live in `index.css`'s `@theme`/`@custom-variant` blocks (see Design system above).
- **Ollama runs on the host, not in Docker** (deliberately removed from `docker-compose.yml` — the containerized image + model pull consumed too much disk). The `backend` service reaches it via `OLLAMA_BASE_URL=http://host.docker.internal:11434` (set directly in `docker-compose.yml`'s `backend.environment`, overriding whatever is in `.env`), with `extra_hosts: host.docker.internal:host-gateway` so that resolves inside the container. Start Ollama locally (`ollama serve`, or the desktop app) before running the backend. `.env`'s `OLLAMA_MODEL` must match a model you've actually pulled locally (`ollama list` to check) — it currently is NOT `llama3` (the cahier des charges default) but whatever is set in `.env`, since `llama3` isn't pulled on the dev machine. `.env.example`'s `OLLAMA_BASE_URL` reflects the non-Docker (host-run) default and is only used if you run the backend outside Docker — the Docker Compose override always wins inside containers.
