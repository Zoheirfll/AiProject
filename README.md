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

## Authentification

L'application nécessite un compte pour se connecter — pas d'accès anonyme (l'API rejette toute requête non authentifiée en dehors des endpoints `/api/*/health/` et `/api/auth/*`). Deux rôles : **DRH** (accès complet, y compris `/configuration` et les suppressions) et **Chargé RH** (création/exécution/test, sans configuration globale ni suppression).

Créer le tout premier compte (DRH), en ligne de commande — nécessaire une seule fois, avant qu'un DRH existe dans l'interface :

```bash
docker compose exec backend python manage.py create_hr_user drh drh@example.com --password "un-mot-de-passe-fort" --role DRH
```

Ensuite, tous les autres comptes (DRH ou Chargé RH) se créent depuis l'interface, page **Utilisateurs** (visible uniquement pour un DRH) — plus besoin de la ligne de commande au quotidien. Cette page permet aussi de désactiver ou supprimer un compte (un DRH ne peut pas se désactiver/supprimer lui-même, pour éviter de bloquer l'accès si c'est le seul DRH).

Se connecter sur http://localhost:5173/login. La session utilise un cookie httponly (pas de token en `localStorage`) protégé par CSRF ; 5 échecs de connexion pour un même nom d'utilisateur en 15 minutes bloquent temporairement les tentatives suivantes.

## Configuration SMTP (Gmail)

L'envoi de mails utilise Gmail SMTP. Les identifiants viennent uniquement du fichier `.env` (jamais commités, jamais codés en dur) :

```bash
EMAIL_HOST_USER=votre-compte@gmail.com
EMAIL_HOST_PASSWORD=xxxxxxxxxxxxxxxx   # mot de passe d'application, PAS le mot de passe du compte
```

Si la double authentification (2FA) est activée sur le compte Gmail (recommandé), Google refuse le mot de passe du compte pour SMTP : il faut générer un **mot de passe d'application** dédié sur https://myaccount.google.com/apppasswords et l'utiliser comme `EMAIL_HOST_PASSWORD`. Une authentification refusée (`535 Username and Password not accepted`) signifie presque toujours que ce champ contient le mauvais type de mot de passe.

La connexion SMTP peut être testée sans envoyer de mail depuis la page `/configuration` de l'application ("Tester la connexion SMTP").

## n8n — accès réseau local et pare-feu Windows (US-E7-01)

n8n est accessible en HTTP simple (pas HTTPS) sur `http://<IP-de-ce-PC>:5678` depuis n'importe quelle machine du réseau local (le conteneur écoute déjà sur `0.0.0.0`, voir `N8N_LISTEN_ADDRESS` dans `docker-compose.yml`). Deux choses à faire manuellement, **une seule fois** :

1. **Trouver l'IP locale du PC** (PowerShell) :
   ```powershell
   ipconfig | Select-String "IPv4"
   ```
   Mettre à jour `N8N_HOST` dans `.env` avec cette IP (ex: `N8N_HOST=192.168.1.42`), puis `docker compose up -d n8n`.

2. **Ouvrir le port 5678 au réseau local uniquement** (pare-feu Windows), en PowerShell **en administrateur** — à exécuter toi-même, ceci n'est pas fait automatiquement :
   ```powershell
   New-NetFirewallRule -DisplayName "GRH-Auto n8n (LAN)" -Direction Inbound -Protocol TCP -LocalPort 5678 -Action Allow -Profile Private
   ```
   `-Profile Private` limite la règle au réseau local (pas au profil "Public"/internet) — c'est ce qui garantit qu'aucune donnée ne sort du réseau local (conformité Loi 18/07). Ne pas utiliser `-Profile Any`.

   Pour vérifier la règle : `Get-NetFirewallRule -DisplayName "GRH-Auto n8n (LAN)"`. Pour la retirer : `Remove-NetFirewallRule -DisplayName "GRH-Auto n8n (LAN)"`.

3. **Authentification n8n** : `N8N_BASIC_AUTH_ACTIVE`/`N8N_BASIC_AUTH_PASSWORD` dans `.env` sont ignorés par les versions récentes de n8n (≥ 1.x) — n8n gère désormais ses propres comptes utilisateur (email + mot de passe), configurés via un écran de création de compte au tout premier accès à http://localhost:5678 (pas de compte par défaut). Si un compte "propriétaire" existe déjà mais que les identifiants sont perdus, le réinitialiser avec `docker compose exec n8n n8n user-management:reset` (supprime le compte actuel, permet d'en recréer un — sans toucher aux workflows déjà importés).

`docker-compose.yml` désactive aussi la télémétrie n8n et les vérifications de mise à jour (`N8N_DIAGNOSTICS_ENABLED`, `N8N_VERSION_NOTIFICATIONS_ENABLED`, etc. à `false`) pour qu'aucun appel sortant vers n8n.io ne se produise.

Templates de workflows prêts à importer : voir `n8n/workflows/README.md`.

## Structure

```
backend/        Django (apps: accounts, core, employees, agents, automatisations, dashboard, integrations, n8n_integration)
frontend/       React + Vite + Tailwind
n8n/workflows/  Workflows n8n exportés
docker-compose.yml
.env.example
```

## Phases

- **Phase 1** (en cours) : scaffolding monorepo, Docker Compose, apps Django, base React
- Phase 2+ : à définir après validation de la Phase 1
