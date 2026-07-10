# GRH-Auto

Plateforme d'automatisation RH — MVP v3.0. Conforme loi algérienne 18/07 (100% local, aucune donnée hors territoire).

## Stack

- Backend : Django 5 + DRF + Strawberry GraphQL + Channels (WebSocket)
- Frontend : React 18 + Vite + Tailwind CSS v4 + React Query + Recharts
- Base de données : PostgreSQL 16
- Scheduler : APScheduler
- IA : Ollama (LLM local) + LangChain (agents : Analyste, Assistant Chat, Orchestrateur)
- Workflows visuels : n8n Self-Hosted
- Orchestration : Docker Compose

## Démarrage (Phase 1)

```bash
cp .env.example .env   # ajuster les secrets
docker compose up --build
```

Services :

| Service  | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:8000 |
| GraphQL  | http://localhost:8000/graphql/ |
| n8n      | http://localhost:5678 |
| Ollama   | http://localhost:11434 |

## Configuration SMTP (Gmail)

L'envoi de mails utilise Gmail SMTP. Les identifiants viennent uniquement du fichier `.env` (jamais commités, jamais codés en dur) :

```bash
EMAIL_HOST_USER=votre-compte@gmail.com
EMAIL_HOST_PASSWORD=xxxxxxxxxxxxxxxx   # mot de passe d'application, PAS le mot de passe du compte
```

Si la double authentification (2FA) est activée sur le compte Gmail (recommandé), Google refuse le mot de passe du compte pour SMTP : il faut générer un **mot de passe d'application** dédié sur https://myaccount.google.com/apppasswords et l'utiliser comme `EMAIL_HOST_PASSWORD`. Une authentification refusée (`535 Username and Password not accepted`) signifie presque toujours que ce champ contient le mauvais type de mot de passe.

La connexion SMTP peut être testée sans envoyer de mail depuis la page `/configuration` de l'application ("Tester la connexion SMTP").

## Structure

```
backend/        Django (apps: core, employees, agents, integrations)
frontend/       React + Vite + Tailwind
n8n/workflows/  Workflows n8n exportés
docker-compose.yml
.env.example
```

## Phases

- **Phase 1** (en cours) : scaffolding monorepo, Docker Compose, apps Django, base React
- Phase 2+ : à définir après validation de la Phase 1
