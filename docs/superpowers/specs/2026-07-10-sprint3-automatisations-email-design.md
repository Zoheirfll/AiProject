# Sprint 3 — E3 Automatisations & E4 Email — Design

## Contexte

Cahier des charges v4 (Agile), Epics E3 et E4. Sprint 1 (Infra) et Sprint 2 (Import Excel) sont faits. Ce sprint couvre :
- **E3** : règles d'alerte de contrats expirants avec délais configurables (ex: J-45/J-20/J-7), rapport quotidien 9h via Ollama, déclenchement manuel, destinataires configurables.
- **E4** : preview/édition avant envoi avec régénération Ollama, templates HTML/texte, test de connexion SMTP.

## Portée

Backend + frontend minimal (UI de gestion des règles, historique des mails). Pas de couverture des Epics E5 (Dashboard), E6 (Agents AI), E7 (n8n), E8 (Temps réel/Logs) dans ce sprint.

## Apps Django

Deux nouvelles apps dédiées, suivant le pattern déjà en place (`core`, `employees`) :
- `backend/automatisations/`
- `backend/mails/`

Chacune avec `models.py`/`serializers.py`/`views.py`/`urls.py`/`admin.py`, et un endpoint `GET /api/<app>/health/` placeholder par convention du projet.

## Modèles

### `automatisations/models.py`

**`RegleAutomatisation`**
| Champ | Type | Notes |
|---|---|---|
| `nom` | CharField | |
| `actif` | BooleanField | |
| `delais_jours` | JSONField | ex `[45, 20, 7]` — chaque délai déclenche indépendamment |
| `departements_filtre` | JSONField | liste optionnelle ; vide = tous les départements |
| `destinataires` | JSONField | liste d'emails fixes et/ou `"departement:<nom>"` pour résolution dynamique à l'envoi |
| `cc` / `bcc` | JSONField | mêmes conventions que `destinataires` |
| `prompt_override` | TextField, blank | si vide, utilise le prompt global (`ollama_client.DEFAULT_MAIL_PROMPT` ou équivalent règle) |
| `created_at` / `updated_at` | DateTimeField | |

**`AlerteEnvoyee`**
| Champ | Type | Notes |
|---|---|---|
| `regle` | FK → RegleAutomatisation | |
| `contract` | FK → employees.Contract | |
| `delai_jours` | IntegerField | quel délai a déclenché l'envoi |
| `date_envoi` | DateTimeField, auto_now_add | |

Contrainte unique `(regle, contract, delai_jours)` — empêche les doublons et sert d'historique/audit pour les Epics futurs (E5 dashboard, E8 logs).

### `mails/models.py`

**`HistoriqueMail`**
| Champ | Type | Notes |
|---|---|---|
| `regle` | FK → RegleAutomatisation, null=True | null si envoi manuel |
| `employee` | FK → employees.Employee | |
| `sujet` / `corps` | Char/Text | |
| `format` | CharField (HTML/TEXTE) | |
| `destinataires` / `cc` / `bcc` | JSONField | valeurs résolues (emails finaux, pas les alias département) |
| `statut` | CharField (ENVOYE/ECHEC) | |
| `erreur` | TextField, blank | détail si échec |
| `envoye_at` | DateTimeField | |

## Logique métier (`automatisations/services.py`)

### `evaluer_regles(regle_id=None)`

Appelée par le job APScheduler quotidien 9h (enregistré dans `integrations/scheduler.py`), ou par `POST /api/automatisations/:id/run/` avec `regle_id` fixé.

Pour chaque `RegleAutomatisation` active (ou la règle ciblée) :
1. Calcule les contrats dont `date_fin - aujourd'hui` correspond à un des `delais_jours`.
2. Filtre par `departements_filtre` si renseigné.
3. Exclut les `(contrat, délai)` déjà présents dans `AlerteEnvoyee`.
4. Pour chaque match restant :
   - Résout `destinataires`/`cc`/`bcc` (emails fixes + expansion des alias département).
   - Génère sujet/corps via `ollama_client.generate_mail_content`, avec substitution des variables `{{nom}}`, `{{departement}}`, `{{date_fin}}`, `{{jours_restants}}` dans le prompt (global ou `prompt_override`).
   - Envoie directement via Django `EmailMessage` (SMTP Gmail, credentials `.env`).
   - Écrit `HistoriqueMail` (statut ENVOYE ou ECHEC) et, si succès, `AlerteEnvoyee`.
5. Erreurs (Ollama injoignable, échec SMTP) isolées par `try/except` par item — n'interrompent pas le reste du batch. `HistoriqueMail.statut=ECHEC` + `erreur` renseignée dans ce cas ; pas d'entrée `AlerteEnvoyee` (permet un nouveau essai au run suivant).

### Rapport quotidien 9h

Deuxième job APScheduler, même heure. Génère un résumé (contrats expirant à venir, imports du jour) via Ollama et l'envoie aux destinataires configurés (réutilise le mécanisme `HistoriqueMail`, `regle=None`).

### Déclenchement manuel

`POST /api/automatisations/:id/run/` → `evaluer_regles(regle_id)`, écrit dans `AlerteEnvoyee` normalement (mêmes garanties anti-doublon que le job planifié).

`POST /api/automatisations/:id/test/` → envoie un mail de test au(x) destinataire(s) actuel(s) de la règle sans écrire dans `AlerteEnvoyee` (permet de re-tester sans consommer la déduplication).

## Flux email manuel (E4 preview/édition)

Le déclenchement automatique (job 9h) envoie directement, sans validation humaine. Le flux preview/édition ne s'applique qu'à l'envoi manuel initié depuis l'UI :

1. `POST /api/mails/apercu/` — génère sujet/corps via Ollama (mêmes variables que ci-dessus) sans envoyer. Retourne le contenu éditable.
2. Utilisateur édite sujet/corps dans l'UI, peut cliquer "régénérer via Ollama" (réappelle `/apercu/`).
3. `POST /api/mails/envoyer/` — envoie le contenu final (potentiellement édité), écrit `HistoriqueMail`.

## API REST

### `automatisations`
- `GET/POST /api/automatisations/`
- `GET/PUT/DELETE /api/automatisations/:id/`
- `POST /api/automatisations/:id/run/`
- `POST /api/automatisations/:id/test/`

### `mails`
- `POST /api/mails/apercu/`
- `POST /api/mails/envoyer/`
- `GET /api/mails/historique/` (filtres : `statut`, `date`, `employee`)
- `POST /api/config/smtp/test/` — tente une connexion SMTP avec les credentials `.env` (`EMAIL_HOST_USER`/`EMAIL_HOST_PASSWORD` existants), retourne succès/erreur. Ne stocke rien en DB.

## Configuration SMTP

Reste dans `.env` uniquement (cohérent avec CLAUDE.md : SMTP Gmail est le seul appel sortant autorisé, pas de nouveau stockage de secrets en DB). L'UI expose un bouton "Tester la connexion" qui appelle `/api/config/smtp/test/`.

## Frontend minimal

- **Page `/automatisations`** : tableau des règles (nom, délais, actif/inactif), formulaire création/édition (délais, filtre département, destinataires/cc/bcc, prompt override), boutons "Exécuter maintenant" et "Tester".
- **Page `/mails/historique`** : tableau filtrable de `HistoriqueMail` (statut, date, employé).
- **Modale preview/édition** : sujet + corps éditables, bouton "régénérer via Ollama", bouton "Envoyer".

## Hors périmètre (rappel)

- Dashboard/KPIs (E5), agents AI autonomes (E6), endpoints n8n (E7), notifications temps réel/logs enrichis (E8) — sprints suivants.
- Templates HTML riches vs texte brut : le choix de `format` est stocké mais le rendu HTML avancé (mise en forme, logo, etc.) n'est pas détaillé ici — MVP texte/HTML simple.
