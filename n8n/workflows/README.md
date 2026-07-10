# Workflows n8n — GRH-Auto

4 templates prêts à l'emploi (US-E7-03). Aucun ne s'active automatiquement à l'import (`"active": false`) — à activer manuellement dans n8n une fois vérifié.

## Import

Dans n8n : **Workflows → Import from File**, choisir un des `.json` ci-dessous. Répéter pour les 4.

- `alerte_contrats_expirants.json` — tous les jours à 8h, alerte l'employé si son contrat expire sous N jours (configurable dans le nœud "Configuration").
- `rapport_quotidien.json` — tous les jours à 9h, envoie au DRH un résumé de l'effectif + des contrats expirant sous 45 jours (généré par Ollama via GRH-Auto).
- `notification_nouvel_employe.json` — déclenché par un webhook (`POST /webhook/grh-auto/nouvel-employe` avec `{"employee_id": 123}`), envoie un mail de bienvenue HTML.
- `escalade_drh_contrat_non_renouvele.json` — tous les jours à 8h, alerte directement le DRH (pas l'employé) si un contrat arrive à échéance sous 7 jours sans avoir été renouvelé.

## Configuration requise (une seule fois)

1. **Credential partagé** : dans n8n, créer une credential de type **Header Auth** nommée exactement `GRH-Auto API Token` :
   - Header name : `Authorization`
   - Header value : `Bearer <la valeur de N8N_API_TOKEN dans .env>`

   Les 4 workflows référencent cette credential par son nom — un seul endroit à mettre à jour si le token change.

2. **Variable d'environnement** `GRH_AUTO_URL` accessible par n8n (déjà le cas dans `docker-compose.yml` puisque n8n et le backend Django sont sur le même réseau Docker) :
   ```
   GRH_AUTO_URL=http://backend:8000
   ```
   Si ce n'est pas déjà défini, ajouter `GRH_AUTO_URL: http://backend:8000` aux `environment:` du service `n8n` dans `docker-compose.yml`.

3. Adapter les adresses email codées dans les nœuds "Configuration" (`drh_email`, etc.) à votre organisation.

## Endpoints Django utilisés

Tous sous `/api/n8n/*`, protégés par le token statique (voir `backend/n8n_integration/`) :

- `GET /api/n8n/employes/` — employés actifs
- `GET /api/n8n/contrats-expirants/?jours=N` — contrats expirant sous N jours
- `POST /api/n8n/mails/envoyer/` — génère (Ollama) et envoie un mail en un seul appel
- `POST /api/n8n/logs/` — enregistre un événement libre
- `GET /api/n8n/health/` — health check (sans token)

Chaque appel (succès ou refusé) est automatiquement journalisé dans `N8nApiLog` (visible dans l'admin Django, `/admin/n8n_integration/n8napilog/`).
