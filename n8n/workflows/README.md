# Workflows n8n — GRH-Auto

4 templates prêts à l'emploi (US-E7-03). Aucun ne s'active automatiquement à l'import (`"active": false`) — à activer manuellement dans n8n une fois vérifié.

## Import

Dans n8n : **Workflows → Import from File**, choisir un des `.json` ci-dessous. Répéter pour les 4.

- `alerte_contrats_expirants.json` — tous les jours à 8h, alerte l'employé si son contrat expire sous N jours (configurable dans le nœud "Configuration").
- `rapport_quotidien.json` — tous les jours à 9h, envoie au DRH un résumé de l'effectif + des contrats expirant sous 45 jours (généré par Ollama via GRH-Auto).
- `notification_nouvel_employe.json` — déclenché par un webhook (`POST /webhook/grh-auto/nouvel-employe` avec `{"employee_id": 123}`), envoie un mail de bienvenue HTML.
- `escalade_drh_contrat_non_renouvele.json` — tous les jours à 8h, alerte directement le DRH (pas l'employé) si un contrat arrive à échéance sous 7 jours sans avoir été renouvelé.

## Configuration requise (une seule fois)

1. **Credential(s) Header Auth** : les tokens ne sont plus un secret global unique — chaque `N8nApiToken` (créé par un DRH dans l'admin Django, `/admin/n8n_integration/n8napitoken/`) n'a que les scopes dont son workflow a besoin, et peut être révoqué (`actif=False`) indépendamment des autres sans casser le reste.

   Une migration a automatiquement créé un token « Token par défaut (migration E7) » avec les 4 scopes, à partir de l'ancienne valeur `N8N_API_TOKEN` — la credential `GRH-Auto API Token` déjà configurée dans n8n continue donc de fonctionner sans rien changer. Pour un cloisonnement réel par workflow, créez un token dédié par workflow (voir scopes requis ci-dessous) et une credential Header Auth distincte pointant dessus :
   - Header name : `Authorization`
   - Header value : `Bearer <valeur du token créé dans l'admin Django>`

   Scopes requis par template :
   - `alerte_contrats_expirants.json` → `contrats:read`, `mails:send`
   - `rapport_quotidien.json` → `employes:read`, `contrats:read`, `mails:send`
   - `notification_nouvel_employe.json` → `mails:send`
   - `escalade_drh_contrat_non_renouvele.json` → `contrats:read`, `mails:send`

2. **Variable d'environnement** `GRH_AUTO_URL` accessible par n8n (déjà le cas dans `docker-compose.yml` puisque n8n et le backend Django sont sur le même réseau Docker) :
   ```
   GRH_AUTO_URL=http://backend:8000
   ```
   Si ce n'est pas déjà défini, ajouter `GRH_AUTO_URL: http://backend:8000` aux `environment:` du service `n8n` dans `docker-compose.yml`.

3. Adapter les adresses email codées dans les nœuds "Configuration" (`drh_email`, etc.) à votre organisation.

## Endpoints Django utilisés

Tous sous `/api/n8n/*`, protégés par un token scopé (`N8nApiToken` + `HasN8nScope`, voir `backend/n8n_integration/`) — chaque endpoint exige un scope précis, pas juste un token valide :

- `GET /api/n8n/employes/` — employés actifs (scope `employes:read`)
- `GET /api/n8n/contrats-expirants/?jours=N` — contrats expirant sous N jours (scope `contrats:read`)
- `POST /api/n8n/mails/envoyer/` — génère (Ollama) et envoie un mail en un seul appel (scope `mails:send`)
- `POST /api/n8n/logs/` — enregistre un événement libre (scope `logs:write`)
- `GET /api/n8n/health/` — health check (sans token)

Chaque appel (succès ou refusé) est automatiquement journalisé dans `N8nApiLog`, avec le token utilisé (visible dans l'admin Django, `/admin/n8n_integration/n8napilog/`).
