# Sprint 3 (E3 Automatisations + E4 Email) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build configurable contract-expiry alert rules (with multiple delay thresholds, department filtering, Ollama-generated content, and email delivery) plus a manual preview/edit/send mail flow, backed by a daily-9am APScheduler job and a minimal management UI.

**Architecture:** New `automatisations` Django app owns `RegleAutomatisation` (rule config) and `AlerteEnvoyee` (dedup/audit ledger). The existing `core.MailLog` model (already used by the Phase-3 `mails/apercu/` endpoint) is extended with `cc`/`bcc`/`format`/`regle` fields and reused as the shared mail-history record for both automated and manual sends — no new `mails` app is created, since mail sending already lives in `core`. `automatisations/services.py` holds the rule-evaluation and daily-report logic, called by both the scheduler and manual "run"/"test" endpoints. Manual sends reuse the existing `MailApercuView` (draft generation) plus two new endpoints (`envoyer`, `historique`) in `core`.

**Tech Stack:** Django 5, DRF, APScheduler (`django-apscheduler`), Django's SMTP `EmailMessage`, existing `agents/ollama_client.py`, React 18 + Vite + React Query + Tailwind on the frontend.

## Global Constraints

- Locale fixed to `fr-fr` / `Africa/Algiers` (existing `config/settings.py`) — dates in this plan use `timezone.localdate()`.
- SMTP credentials stay in `.env` only (`EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` already defined in `config/settings.py`) — no new secret storage in DB.
- No cloud LLM — all mail generation goes through `agents.ollama_client.generate_mail_content`, which already exists and must not be modified.
- Follow existing app conventions exactly: `apps.py` with `default_auto_field = "django.db.models.BigAutoField"`, `app_name` in `urls.py`, a `GET /api/<app>/health/` placeholder view, generics-based DRF views (not viewsets — no viewset is used anywhere in this codebase).
- Tests use Django's built-in test runner (`python manage.py test`) — no pytest is installed (`backend/requirements.txt` has no pytest dependency); do not add one.
- Deviation from the approved design doc (`docs/superpowers/specs/2026-07-10-sprint3-automatisations-email-design.md`): that doc proposed a new `mails` app with a `HistoriqueMail` model. Discovery during planning found `core.MailLog` and `POST /api/mails/apercu/` already implemented and wired into the frontend (`MailApercuPage.jsx`). This plan extends `core.MailLog` in place instead of creating a duplicate model/app, to avoid breaking working code. Endpoint paths (`/api/mails/envoyer/`, `/api/mails/historique/`, `/api/config/smtp/test/`) match the design doc.

---

## File Structure

- Create: `backend/automatisations/__init__.py`, `apps.py`, `models.py`, `serializers.py`, `services.py`, `views.py`, `urls.py`, `admin.py`, `migrations/__init__.py`, `migrations/0001_initial.py`, `tests.py`
- Modify: `backend/config/settings.py` (register app), `backend/config/urls.py` (mount routes), `backend/integrations/scheduler.py` (register jobs)
- Modify: `backend/core/models.py` (extend `MailLog`), `backend/core/serializers.py` (extend `MailLogSerializer`), `backend/core/views.py` (add `MailEnvoyerView`, `MailHistoriqueView`, `SmtpTestView`), `backend/core/urls.py` (add routes), `backend/core/tests.py` (new)
- Modify: `frontend/src/lib/api.js` (new API calls), `frontend/src/App.jsx` (new routes)
- Create: `frontend/src/pages/AutomatisationsPage.jsx`, `frontend/src/pages/MailsHistoriquePage.jsx`
- Modify: `frontend/src/pages/MailApercuPage.jsx` (add envoyer + régénérer)

---

### Task 1: `automatisations` app scaffold + `RegleAutomatisation` model

**Files:**
- Create: `backend/automatisations/__init__.py` (empty)
- Create: `backend/automatisations/apps.py`
- Create: `backend/automatisations/models.py`
- Create: `backend/automatisations/migrations/__init__.py` (empty)
- Create: `backend/automatisations/admin.py`
- Create: `backend/automatisations/tests.py`
- Modify: `backend/config/settings.py:14-29`

**Interfaces:**
- Produces: `automatisations.models.RegleAutomatisation` with fields `nom`, `actif`, `delais_jours` (list[int]), `departements_filtre` (list[str]), `destinataires`/`cc`/`bcc` (list[str]), `prompt_override` (str), `created_at`, `updated_at`.

- [ ] **Step 1: Create the app package files**

`backend/automatisations/__init__.py`:
```python
```

`backend/automatisations/apps.py`:
```python
from django.apps import AppConfig


class AutomatisationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "automatisations"
```

`backend/automatisations/migrations/__init__.py`:
```python
```

- [ ] **Step 2: Write the model**

`backend/automatisations/models.py`:
```python
from django.db import models


class RegleAutomatisation(models.Model):
    nom = models.CharField(max_length=255)
    actif = models.BooleanField(default=True)
    delais_jours = models.JSONField(default=list, blank=True)
    departements_filtre = models.JSONField(default=list, blank=True)
    destinataires = models.JSONField(default=list, blank=True)
    cc = models.JSONField(default=list, blank=True)
    bcc = models.JSONField(default=list, blank=True)
    prompt_override = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom
```

- [ ] **Step 3: Register the app**

In `backend/config/settings.py`, modify `INSTALLED_APPS` (currently ends `"core", "employees", "agents", "integrations"`):
```python
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "channels",
    "django_apscheduler",
    "core",
    "employees",
    "agents",
    "integrations",
    "automatisations",
]
```

- [ ] **Step 4: Register the admin**

`backend/automatisations/admin.py`:
```python
from django.contrib import admin

from .models import RegleAutomatisation


@admin.register(RegleAutomatisation)
class RegleAutomatisationAdmin(admin.ModelAdmin):
    list_display = ["nom", "actif", "delais_jours", "updated_at"]
```

- [ ] **Step 5: Generate the migration**

Run: `docker compose exec backend python manage.py makemigrations automatisations`
Expected: creates `backend/automatisations/migrations/0001_initial.py` with a `CreateModel` for `RegleAutomatisation`. (If not running via Docker, run `python manage.py makemigrations automatisations` from `backend/` with the venv active and Postgres reachable per `.env`.)

- [ ] **Step 6: Write a model test**

`backend/automatisations/tests.py`:
```python
from django.test import TestCase

from .models import RegleAutomatisation


class RegleAutomatisationModelTests(TestCase):
    def test_defaults(self):
        regle = RegleAutomatisation.objects.create(nom="Alerte contrats CDD")
        self.assertTrue(regle.actif)
        self.assertEqual(regle.delais_jours, [])
        self.assertEqual(regle.destinataires, [])
        self.assertEqual(str(regle), "Alerte contrats CDD")
```

- [ ] **Step 7: Run the test to verify it fails, then passes**

Run: `docker compose exec backend python manage.py test automatisations`
Expected before migration applied: FAIL (`relation "automatisations_regleautomatisation" does not exist`) — run `docker compose exec backend python manage.py migrate` first if needed (Django's test runner creates its own test DB from migrations, so this only matters if migrations are missing).
Run again after Step 5's migration exists: PASS (`Ran 1 test ... OK`).

- [ ] **Step 8: Commit**

```bash
git add backend/automatisations backend/config/settings.py
git commit -m "feat(automatisations): scaffold app with RegleAutomatisation model"
```

---

### Task 2: `AlerteEnvoyee` dedup/audit model

**Files:**
- Modify: `backend/automatisations/models.py`
- Modify: `backend/automatisations/admin.py`
- Modify: `backend/automatisations/tests.py`
- Create: `backend/automatisations/migrations/0002_alerteenvoyee.py` (via makemigrations)

**Interfaces:**
- Consumes: `RegleAutomatisation` (Task 1), `employees.models.Contract` (existing).
- Produces: `automatisations.models.AlerteEnvoyee` with fields `regle` (FK), `contract` (FK), `delai_jours` (int), `date_envoi` (auto_now_add); unique together `(regle, contract, delai_jours)`.

- [ ] **Step 1: Write the failing test**

Append to `backend/automatisations/tests.py`:
```python
from datetime import date

from django.db.utils import IntegrityError

from employees.models import Contract, Employee

from .models import AlerteEnvoyee, RegleAutomatisation


class AlerteEnvoyeeModelTests(TestCase):
    def setUp(self):
        self.employee = Employee.objects.create(matricule="M001", nom="Kadi", prenom="Sara")
        self.contract = Contract.objects.create(
            employee=self.employee, type=Contract.Type.CDD,
            date_debut=date(2026, 1, 1), date_fin=date(2026, 8, 1),
        )
        self.regle = RegleAutomatisation.objects.create(nom="Alerte CDD", delais_jours=[45, 20, 7])

    def test_unique_per_regle_contract_delai(self):
        AlerteEnvoyee.objects.create(regle=self.regle, contract=self.contract, delai_jours=45)
        with self.assertRaises(IntegrityError):
            AlerteEnvoyee.objects.create(regle=self.regle, contract=self.contract, delai_jours=45)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec backend python manage.py test automatisations.tests.AlerteEnvoyeeModelTests`
Expected: FAIL with `ImportError: cannot import name 'AlerteEnvoyee'`.

- [ ] **Step 3: Add the model**

In `backend/automatisations/models.py`, append:
```python
from employees.models import Contract


class AlerteEnvoyee(models.Model):
    regle = models.ForeignKey(RegleAutomatisation, on_delete=models.CASCADE, related_name="alertes")
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="alertes_envoyees")
    delai_jours = models.IntegerField()
    date_envoi = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("regle", "contract", "delai_jours")
        ordering = ["-date_envoi"]

    def __str__(self):
        return f"{self.contract} - J-{self.delai_jours}"
```

- [ ] **Step 4: Register in admin**

In `backend/automatisations/admin.py`, add:
```python
from .models import AlerteEnvoyee, RegleAutomatisation


@admin.register(AlerteEnvoyee)
class AlerteEnvoyeeAdmin(admin.ModelAdmin):
    list_display = ["regle", "contract", "delai_jours", "date_envoi"]
```
(Keep the existing `RegleAutomatisationAdmin` registration above it.)

- [ ] **Step 5: Generate migration and run tests**

Run: `docker compose exec backend python manage.py makemigrations automatisations`
Expected: creates `0002_alerteenvoyee.py`.

Run: `docker compose exec backend python manage.py test automatisations`
Expected: `Ran 2 tests ... OK`.

- [ ] **Step 6: Commit**

```bash
git add backend/automatisations
git commit -m "feat(automatisations): add AlerteEnvoyee dedup/audit model"
```

---

### Task 3: `RegleAutomatisation` CRUD API

**Files:**
- Create: `backend/automatisations/serializers.py`
- Create: `backend/automatisations/views.py`
- Create: `backend/automatisations/urls.py`
- Modify: `backend/config/urls.py:8-15`
- Modify: `backend/automatisations/tests.py`

**Interfaces:**
- Produces: `GET/POST /api/automatisations/`, `GET/PUT/DELETE /api/automatisations/<pk>/`, `GET /api/automatisations/health/`.

- [ ] **Step 1: Write the failing test**

Append to `backend/automatisations/tests.py`:
```python
from rest_framework.test import APITestCase


class RegleAutomatisationApiTests(APITestCase):
    def test_create_and_list(self):
        payload = {
            "nom": "Alerte CDD",
            "delais_jours": [45, 20, 7],
            "destinataires": ["rh@example.com"],
        }
        response = self.client.post("/api/automatisations/", payload, format="json")
        self.assertEqual(response.status_code, 201)

        response = self.client.get("/api/automatisations/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["nom"], "Alerte CDD")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec backend python manage.py test automatisations.tests.RegleAutomatisationApiTests`
Expected: FAIL (404, no such URL — `automatisations.urls` not yet wired).

- [ ] **Step 3: Write the serializer**

`backend/automatisations/serializers.py`:
```python
from rest_framework import serializers

from .models import RegleAutomatisation


class RegleAutomatisationSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegleAutomatisation
        fields = [
            "id",
            "nom",
            "actif",
            "delais_jours",
            "departements_filtre",
            "destinataires",
            "cc",
            "bcc",
            "prompt_override",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]
```

- [ ] **Step 4: Write the views**

`backend/automatisations/views.py`:
```python
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import RegleAutomatisation
from .serializers import RegleAutomatisationSerializer


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok", "app": "automatisations"})


class RegleListCreateView(ListCreateAPIView):
    queryset = RegleAutomatisation.objects.all()
    serializer_class = RegleAutomatisationSerializer


class RegleDetailView(RetrieveUpdateDestroyAPIView):
    queryset = RegleAutomatisation.objects.all()
    serializer_class = RegleAutomatisationSerializer
```

- [ ] **Step 5: Write the urls**

`backend/automatisations/urls.py`:
```python
from django.urls import path

from .views import HealthView, RegleDetailView, RegleListCreateView

app_name = "automatisations"

urlpatterns = [
    path("automatisations/health/", HealthView.as_view(), name="health"),
    path("automatisations/", RegleListCreateView.as_view(), name="regles-list"),
    path("automatisations/<int:pk>/", RegleDetailView.as_view(), name="regles-detail"),
]
```

- [ ] **Step 6: Mount in config urls**

In `backend/config/urls.py`, modify `urlpatterns`:
```python
urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
    path("api/", include("employees.urls")),
    path("api/", include("agents.urls")),
    path("api/", include("integrations.urls")),
    path("api/", include("automatisations.urls")),
    path("graphql/", csrf_exempt(AsyncGraphQLView.as_view(schema=schema))),
]
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `docker compose exec backend python manage.py test automatisations`
Expected: `Ran 3 tests ... OK`.

- [ ] **Step 8: Commit**

```bash
git add backend/automatisations backend/config/urls.py
git commit -m "feat(automatisations): add RegleAutomatisation CRUD API"
```

---

### Task 4: Extend `core.MailLog` with `cc`/`bcc`/`format`/`regle`

**Files:**
- Modify: `backend/core/models.py:27-52`
- Modify: `backend/core/serializers.py:22-36`
- Create: `backend/core/tests.py`

**Interfaces:**
- Consumes: `automatisations.models.RegleAutomatisation` (Task 1).
- Produces: `core.models.MailLog.cc`/`bcc` (list[str]), `.format` (`"HTML"`/`"TEXTE"`), `.regle` (nullable FK) — all consumed by Task 5's `evaluer_regles` and Task 8/9's mail endpoints.

- [ ] **Step 1: Write the failing test**

`backend/core/tests.py`:
```python
from django.test import TestCase

from .models import MailLog


class MailLogModelTests(TestCase):
    def test_new_fields_default(self):
        mail_log = MailLog.objects.create(sujet_demande="Test")
        self.assertEqual(mail_log.cc, [])
        self.assertEqual(mail_log.bcc, [])
        self.assertEqual(mail_log.format, MailLog.Format.TEXTE)
        self.assertIsNone(mail_log.regle)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec backend python manage.py test core.tests.MailLogModelTests`
Expected: FAIL (`AttributeError: 'MailLog' object has no attribute 'cc'`).

- [ ] **Step 3: Extend the model**

In `backend/core/models.py`, modify the `MailLog` class:
```python
class MailLog(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Brouillon"
        SENT = "SENT", "Envoyé"
        FAILED = "FAILED", "Échec"

    class Format(models.TextChoices):
        TEXTE = "TEXTE", "Texte"
        HTML = "HTML", "HTML"

    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mails",
    )
    regle = models.ForeignKey(
        "automatisations.RegleAutomatisation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mails",
    )
    sujet_demande = models.CharField(max_length=255)
    subject = models.CharField(max_length=255, blank=True)
    body = models.TextField(blank=True)
    format = models.CharField(max_length=10, choices=Format.choices, default=Format.TEXTE)
    cc = models.JSONField(default=list, blank=True)
    bcc = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    erreur = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Mail {self.id} - {self.status}"
```

- [ ] **Step 4: Extend the serializer**

In `backend/core/serializers.py`, modify `MailLogSerializer`:
```python
class MailLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = MailLog
        fields = [
            "id",
            "employee",
            "regle",
            "sujet_demande",
            "subject",
            "body",
            "format",
            "cc",
            "bcc",
            "status",
            "erreur",
            "created_at",
            "sent_at",
        ]
        read_only_fields = ["status", "erreur", "created_at", "sent_at"]
```
(Note: `subject`/`body` are now writable — Task 8's `MailEnvoyerView` sets them from user edits before sending; `format` is included so the frontend can request HTML vs texte on preview.)

- [ ] **Step 5: Generate migration and run tests**

Run: `docker compose exec backend python manage.py makemigrations core`
Expected: creates a migration adding `regle`, `format`, `cc`, `bcc` to `MailLog`. Since `automatisations` (Task 1) must exist before this FK can be created, this must run after Task 1/2 are applied — it already is, given task order.

Run: `docker compose exec backend python manage.py test core`
Expected: `Ran 1 test ... OK`.

- [ ] **Step 6: Commit**

```bash
git add backend/core/models.py backend/core/serializers.py backend/core/tests.py backend/core/migrations
git commit -m "feat(core): extend MailLog with cc/bcc/format/regle for automation and manual sends"
```

---

### Task 5: `evaluer_regles` rule-evaluation service

**Files:**
- Create: `backend/automatisations/services.py`
- Modify: `backend/automatisations/tests.py`

**Interfaces:**
- Consumes: `RegleAutomatisation`, `AlerteEnvoyee` (Tasks 1-2), `core.models.MailLog` (Task 4), `employees.models.{Employee,Contract}` (existing), `agents.ollama_client.generate_mail_content`/`OllamaGenerationError` (existing, unmodified).
- Produces: `automatisations.services.evaluer_regles(regle_id=None) -> list[MailLog]` and `automatisations.services.generer_rapport_quotidien() -> MailLog | None`, both consumed by Task 6 (manual run/test endpoints) and Task 7 (scheduler jobs).

- [ ] **Step 1: Write the failing test**

Append to `backend/automatisations/tests.py`:
```python
from unittest.mock import patch

from django.core import mail
from django.test import override_settings
from django.utils import timezone

from core.models import MailLog

from .services import evaluer_regles


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class EvaluerReglesTests(TestCase):
    def setUp(self):
        self.employee = Employee.objects.create(
            matricule="M002", nom="Belkacem", prenom="Yacine",
            email="yacine@example.com", departement="IT",
        )
        today = timezone.localdate()
        self.contract = Contract.objects.create(
            employee=self.employee, type=Contract.Type.CDD,
            date_debut=date(2026, 1, 1), date_fin=today + timedelta(days=7),
        )
        self.regle = RegleAutomatisation.objects.create(
            nom="Alerte CDD", delais_jours=[45, 20, 7],
            destinataires=["yacine@example.com"],
        )

    @patch("automatisations.services.generate_mail_content")
    def test_sends_and_records_alert(self, mock_generate):
        mock_generate.return_value = {"subject": "Votre contrat expire bientôt", "body": "Bonjour Yacine..."}

        resultats = evaluer_regles()

        self.assertEqual(len(resultats), 1)
        self.assertEqual(resultats[0].status, MailLog.Status.SENT)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["yacine@example.com"])
        self.assertTrue(
            AlerteEnvoyee.objects.filter(regle=self.regle, contract=self.contract, delai_jours=7).exists()
        )

    @patch("automatisations.services.generate_mail_content")
    def test_does_not_resend_within_dedup_window(self, mock_generate):
        mock_generate.return_value = {"subject": "S", "body": "B"}
        evaluer_regles()
        mail.outbox.clear()

        resultats = evaluer_regles()

        self.assertEqual(resultats, [])
        self.assertEqual(len(mail.outbox), 0)
```

Add the missing imports at the top of `backend/automatisations/tests.py` (alongside the existing ones): `from datetime import timedelta`.

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec backend python manage.py test automatisations.tests.EvaluerReglesTests`
Expected: FAIL (`ModuleNotFoundError: No module named 'automatisations.services'`).

- [ ] **Step 3: Write the service**

`backend/automatisations/services.py`:
```python
from datetime import timedelta

from django.core.mail import EmailMessage
from django.utils import timezone

from agents.ollama_client import OllamaGenerationError, generate_mail_content
from core.models import ExcelImport, MailLog
from employees.models import Contract, Employee

from .models import AlerteEnvoyee, RegleAutomatisation


def _resoudre_liste(entries):
    resolved = set()
    for entry in entries:
        if entry.startswith("departement:"):
            departement = entry.split(":", 1)[1]
            resolved.update(
                Employee.objects.filter(departement__iexact=departement, actif=True)
                .exclude(email="")
                .values_list("email", flat=True)
            )
        elif entry:
            resolved.add(entry)
    return sorted(resolved)


def _substituer_variables(prompt, variables):
    resultat = prompt
    for cle, valeur in variables.items():
        resultat = resultat.replace("{{" + cle + "}}", valeur)
    return resultat


def _envoyer_alerte(regle, contract, jours_restants, marquer_alerte=True):
    employee = contract.employee
    destinataires = _resoudre_liste(regle.destinataires)
    cc = _resoudre_liste(regle.cc)
    bcc = _resoudre_liste(regle.bcc)

    sujet_demande = (
        f"Alerte contrat: {employee.prenom} {employee.nom} — "
        f"expire dans {jours_restants} jours ({contract.date_fin})"
    )

    mail_log = MailLog.objects.create(
        employee=employee, regle=regle, sujet_demande=sujet_demande, cc=cc, bcc=bcc,
    )

    prompt_final = None
    if regle.prompt_override:
        prompt_final = _substituer_variables(
            regle.prompt_override,
            {
                "nom": f"{employee.prenom} {employee.nom}",
                "departement": employee.departement or "N/A",
                "date_fin": contract.date_fin.isoformat(),
                "jours_restants": str(jours_restants),
            },
        )

    try:
        result = generate_mail_content(employee, sujet_demande, prompt_final)
    except OllamaGenerationError as exc:
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = str(exc)
        mail_log.save()
        return mail_log

    mail_log.subject = result["subject"]
    mail_log.body = result["body"]

    if not destinataires:
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = "Aucun destinataire résolu pour cette règle."
        mail_log.save()
        return mail_log

    try:
        EmailMessage(
            subject=mail_log.subject, body=mail_log.body,
            to=destinataires, cc=cc or None, bcc=bcc or None,
        ).send(fail_silently=False)
    except Exception as exc:  # noqa: BLE001
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = str(exc)
        mail_log.save()
        return mail_log

    mail_log.status = MailLog.Status.SENT
    mail_log.sent_at = timezone.now()
    mail_log.save()

    if marquer_alerte:
        AlerteEnvoyee.objects.create(regle=regle, contract=contract, delai_jours=jours_restants)

    return mail_log


def evaluer_regles(regle_id=None):
    regles = RegleAutomatisation.objects.filter(actif=True)
    if regle_id is not None:
        regles = regles.filter(pk=regle_id)

    today = timezone.localdate()
    resultats = []

    for regle in regles:
        contracts = Contract.objects.filter(date_fin__isnull=False).select_related("employee")
        if regle.departements_filtre:
            contracts = contracts.filter(employee__departement__in=regle.departements_filtre)

        for contract in contracts:
            jours_restants = (contract.date_fin - today).days
            if jours_restants not in regle.delais_jours:
                continue
            if AlerteEnvoyee.objects.filter(
                regle=regle, contract=contract, delai_jours=jours_restants
            ).exists():
                continue
            resultats.append(_envoyer_alerte(regle, contract, jours_restants))

    return resultats


def generer_rapport_quotidien(destinataires=None):
    from django.conf import settings

    today = timezone.localdate()
    horizon = today + timedelta(days=45)
    contrats_proches = Contract.objects.filter(
        date_fin__isnull=False, date_fin__range=(today, horizon)
    ).select_related("employee")
    imports_du_jour = ExcelImport.objects.filter(created_at__date=today)

    lignes = [
        f"- {c.employee.prenom} {c.employee.nom} ({c.employee.departement or 'N/A'}): expire le {c.date_fin}"
        for c in contrats_proches
    ]
    resume_contrats = "\n".join(lignes) or "Aucun contrat n'expire dans les 45 prochains jours."

    corps = (
        f"Rapport quotidien RH — {today.isoformat()}\n\n"
        f"Contrats expirant sous 45 jours:\n{resume_contrats}\n\n"
        f"Imports Excel aujourd'hui: {imports_du_jour.count()}"
    )

    cibles = destinataires if destinataires is not None else (
        [settings.EMAIL_HOST_USER] if settings.EMAIL_HOST_USER else []
    )
    if not cibles:
        return None

    mail_log = MailLog.objects.create(
        sujet_demande="Rapport quotidien RH",
        subject=f"Rapport quotidien RH — {today.isoformat()}",
        body=corps,
    )
    try:
        EmailMessage(subject=mail_log.subject, body=mail_log.body, to=cibles).send(fail_silently=False)
        mail_log.status = MailLog.Status.SENT
        mail_log.sent_at = timezone.now()
    except Exception as exc:  # noqa: BLE001
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = str(exc)
    mail_log.save()
    return mail_log
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose exec backend python manage.py test automatisations`
Expected: `Ran 5 tests ... OK`.

- [ ] **Step 5: Commit**

```bash
git add backend/automatisations/services.py backend/automatisations/tests.py
git commit -m "feat(automatisations): implement rule evaluation and daily report service"
```

---

### Task 6: Manual "run" and "test" endpoints

**Files:**
- Modify: `backend/automatisations/views.py`
- Modify: `backend/automatisations/urls.py`
- Modify: `backend/automatisations/tests.py`

**Interfaces:**
- Consumes: `evaluer_regles`, `_envoyer_alerte` (Task 5), `core.serializers.MailLogSerializer` (Task 4).
- Produces: `POST /api/automatisations/<pk>/run/`, `POST /api/automatisations/<pk>/test/`.

- [ ] **Step 1: Write the failing test**

Append to `backend/automatisations/tests.py`:
```python
class RegleRunTestApiTests(APITestCase):
    def setUp(self):
        self.employee = Employee.objects.create(
            matricule="M003", nom="Haddad", prenom="Nour",
            email="nour@example.com", departement="RH",
        )
        today = timezone.localdate()
        self.contract = Contract.objects.create(
            employee=self.employee, type=Contract.Type.CDD,
            date_debut=date(2026, 1, 1), date_fin=today + timedelta(days=20),
        )
        self.regle = RegleAutomatisation.objects.create(
            nom="Alerte CDD", delais_jours=[20], destinataires=["nour@example.com"],
        )

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    @patch("automatisations.services.generate_mail_content")
    def test_run_sends_matching_alerts(self, mock_generate):
        mock_generate.return_value = {"subject": "S", "body": "B"}
        response = self.client.post(f"/api/automatisations/{self.regle.id}/run/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    @patch("automatisations.services.generate_mail_content")
    def test_test_endpoint_does_not_mark_alert(self, mock_generate):
        mock_generate.return_value = {"subject": "S", "body": "B"}
        response = self.client.post(f"/api/automatisations/{self.regle.id}/test/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(AlerteEnvoyee.objects.exists())
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec backend python manage.py test automatisations.tests.RegleRunTestApiTests`
Expected: FAIL (404 — routes don't exist yet).

- [ ] **Step 3: Add the views**

In `backend/automatisations/views.py`, add imports and views:
```python
from django.shortcuts import get_object_or_404
from django.utils import timezone

from core.serializers import MailLogSerializer
from employees.models import Contract

from .services import _envoyer_alerte, evaluer_regles


class RegleRunView(APIView):
    def post(self, request, pk):
        get_object_or_404(RegleAutomatisation, pk=pk)
        resultats = evaluer_regles(regle_id=pk)
        return Response(MailLogSerializer(resultats, many=True).data, status=200)


class RegleTestView(APIView):
    def post(self, request, pk):
        regle = get_object_or_404(RegleAutomatisation, pk=pk)
        contract = (
            Contract.objects.filter(date_fin__isnull=False)
            .select_related("employee")
            .first()
        )
        if not contract:
            return Response({"detail": "Aucun contrat disponible pour le test."}, status=400)

        jours_restants = (contract.date_fin - timezone.localdate()).days
        mail_log = _envoyer_alerte(regle, contract, jours_restants, marquer_alerte=False)
        return Response(MailLogSerializer(mail_log).data, status=200)
```

- [ ] **Step 4: Wire the urls**

In `backend/automatisations/urls.py`:
```python
from django.urls import path

from .views import HealthView, RegleDetailView, RegleListCreateView, RegleRunView, RegleTestView

app_name = "automatisations"

urlpatterns = [
    path("automatisations/health/", HealthView.as_view(), name="health"),
    path("automatisations/", RegleListCreateView.as_view(), name="regles-list"),
    path("automatisations/<int:pk>/", RegleDetailView.as_view(), name="regles-detail"),
    path("automatisations/<int:pk>/run/", RegleRunView.as_view(), name="regles-run"),
    path("automatisations/<int:pk>/test/", RegleTestView.as_view(), name="regles-test"),
]
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `docker compose exec backend python manage.py test automatisations`
Expected: `Ran 7 tests ... OK`.

- [ ] **Step 6: Commit**

```bash
git add backend/automatisations/views.py backend/automatisations/urls.py backend/automatisations/tests.py
git commit -m "feat(automatisations): add manual run and test endpoints for rules"
```

---

### Task 7: APScheduler daily jobs (9h alerts, 9h05 report)

**Files:**
- Modify: `backend/integrations/scheduler.py`

**Interfaces:**
- Consumes: `automatisations.services.evaluer_regles`, `generer_rapport_quotidien` (Task 5).

- [ ] **Step 1: Update the scheduler**

`backend/integrations/scheduler.py`:
```python
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from django_apscheduler.jobstores import DjangoJobStore

scheduler = BackgroundScheduler()
scheduler.add_jobstore(DjangoJobStore(), "default")


def start():
    if not scheduler.running:
        from automatisations.services import evaluer_regles, generer_rapport_quotidien

        scheduler.add_job(
            evaluer_regles,
            trigger=CronTrigger(hour=9, minute=0),
            id="evaluer_regles_automatisations",
            replace_existing=True,
        )
        scheduler.add_job(
            generer_rapport_quotidien,
            trigger=CronTrigger(hour=9, minute=5),
            id="rapport_quotidien",
            replace_existing=True,
        )
        scheduler.start()
```

(The import of `automatisations.services` is deferred inside `start()`, matching Django's app-loading order — apps aren't guaranteed ready at module import time, and `scheduler.py` may be imported early via `apps.py`/`asgi.py`.)

- [ ] **Step 2: Verify jobs register without error**

Run: `docker compose exec backend python manage.py shell -c "from integrations.scheduler import start, scheduler; start(); print([j.id for j in scheduler.get_jobs()])"`
Expected output includes: `['evaluer_regles_automatisations', 'rapport_quotidien']`

- [ ] **Step 3: Commit**

```bash
git add backend/integrations/scheduler.py
git commit -m "feat(integrations): schedule daily rule evaluation and report jobs at 9h"
```

---

### Task 8: `POST /api/mails/envoyer/` — send previewed/edited mail

**Files:**
- Modify: `backend/core/views.py`
- Modify: `backend/core/urls.py`
- Modify: `backend/core/tests.py`

**Interfaces:**
- Consumes: `core.models.MailLog` (Task 4).
- Produces: `POST /api/mails/envoyer/` — body `{mail_log_id, subject?, body?}`, response is `MailLogSerializer` data.

- [ ] **Step 1: Write the failing test**

Append to `backend/core/tests.py`:
```python
from django.core import mail
from django.test import override_settings
from rest_framework.test import APITestCase

from employees.models import Employee

from .models import MailLog


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class MailEnvoyerApiTests(APITestCase):
    def test_envoyer_sends_edited_content(self):
        employee = Employee.objects.create(
            matricule="M010", nom="Ait", prenom="Ali", email="ali@example.com",
        )
        mail_log = MailLog.objects.create(
            employee=employee, sujet_demande="Rappel", subject="Sujet auto", body="Corps auto",
        )

        response = self.client.post(
            "/api/mails/envoyer/",
            {"mail_log_id": mail_log.id, "subject": "Sujet édité", "body": "Corps édité"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "SENT")
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].subject, "Sujet édité")
        self.assertEqual(mail.outbox[0].to, ["ali@example.com"])

    def test_envoyer_requires_employee_email(self):
        employee = Employee.objects.create(matricule="M011", nom="Sadi", prenom="Lina", email="")
        mail_log = MailLog.objects.create(employee=employee, sujet_demande="Rappel")

        response = self.client.post(
            "/api/mails/envoyer/", {"mail_log_id": mail_log.id}, format="json",
        )
        self.assertEqual(response.status_code, 400)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec backend python manage.py test core.tests.MailEnvoyerApiTests`
Expected: FAIL (404 — endpoint doesn't exist).

- [ ] **Step 3: Add the view**

In `backend/core/views.py`, add import and view:
```python
from django.core.mail import EmailMessage
from django.utils import timezone


class MailEnvoyerView(APIView):
    def post(self, request):
        mail_log_id = request.data.get("mail_log_id")
        subject = request.data.get("subject")
        body = request.data.get("body")

        if not mail_log_id:
            return Response({"detail": "mail_log_id est requis."}, status=400)

        try:
            mail_log = MailLog.objects.get(pk=mail_log_id)
        except MailLog.DoesNotExist:
            return Response({"detail": "Mail introuvable."}, status=404)

        if subject:
            mail_log.subject = subject
        if body:
            mail_log.body = body

        destinataire = mail_log.employee.email if mail_log.employee else None
        if not destinataire:
            return Response({"detail": "L'employé n'a pas d'adresse email."}, status=400)

        try:
            EmailMessage(
                subject=mail_log.subject,
                body=mail_log.body,
                to=[destinataire],
                cc=mail_log.cc or None,
                bcc=mail_log.bcc or None,
            ).send(fail_silently=False)
            mail_log.status = MailLog.Status.SENT
            mail_log.sent_at = timezone.now()
        except Exception as exc:  # noqa: BLE001
            mail_log.status = MailLog.Status.FAILED
            mail_log.erreur = str(exc)
        mail_log.save()

        return Response(MailLogSerializer(mail_log).data, status=200)
```

- [ ] **Step 4: Wire the url**

In `backend/core/urls.py`, add import and route:
```python
from .views import (
    ConfigView,
    HealthView,
    ImportHistoryView,
    ImportUploadView,
    MailApercuView,
    MailEnvoyerView,
)

app_name = "core"

urlpatterns = [
    path("core/health/", HealthView.as_view(), name="health"),
    path("imports/upload/", ImportUploadView.as_view(), name="imports-upload"),
    path("imports/historique/", ImportHistoryView.as_view(), name="imports-historique"),
    path("mails/apercu/", MailApercuView.as_view(), name="mails-apercu"),
    path("mails/envoyer/", MailEnvoyerView.as_view(), name="mails-envoyer"),
    path("config/", ConfigView.as_view(), name="config"),
]
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `docker compose exec backend python manage.py test core`
Expected: `Ran 3 tests ... OK`.

- [ ] **Step 6: Commit**

```bash
git add backend/core/views.py backend/core/urls.py backend/core/tests.py
git commit -m "feat(mails): add manual send endpoint with edited subject/body"
```

---

### Task 9: `GET /api/mails/historique/` — filterable mail history

**Files:**
- Modify: `backend/core/views.py`
- Modify: `backend/core/urls.py`
- Modify: `backend/core/tests.py`

**Interfaces:**
- Produces: `GET /api/mails/historique/?statut=&employee=&date=`.

- [ ] **Step 1: Write the failing test**

Append to `backend/core/tests.py`:
```python
class MailHistoriqueApiTests(APITestCase):
    def test_filters_by_statut(self):
        employee = Employee.objects.create(matricule="M012", nom="Ziani", prenom="Karim")
        MailLog.objects.create(employee=employee, sujet_demande="A", status=MailLog.Status.SENT)
        MailLog.objects.create(employee=employee, sujet_demande="B", status=MailLog.Status.FAILED)

        response = self.client.get("/api/mails/historique/", {"statut": "sent"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["sujet_demande"], "A")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec backend python manage.py test core.tests.MailHistoriqueApiTests`
Expected: FAIL (404).

- [ ] **Step 3: Add the view**

In `backend/core/views.py`, add:
```python
from rest_framework.generics import ListAPIView


class MailHistoriqueView(ListAPIView):
    serializer_class = MailLogSerializer

    def get_queryset(self):
        qs = MailLog.objects.all()
        statut = self.request.query_params.get("statut")
        employee_id = self.request.query_params.get("employee")
        date_str = self.request.query_params.get("date")

        if statut:
            qs = qs.filter(status=statut.upper())
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        if date_str:
            qs = qs.filter(created_at__date=date_str)

        return qs
```
(`ListAPIView` is already imported at the top of `core/views.py`; no new import needed for it.)

- [ ] **Step 4: Wire the url**

In `backend/core/urls.py`:
```python
from .views import (
    ConfigView,
    HealthView,
    ImportHistoryView,
    ImportUploadView,
    MailApercuView,
    MailEnvoyerView,
    MailHistoriqueView,
)

urlpatterns = [
    path("core/health/", HealthView.as_view(), name="health"),
    path("imports/upload/", ImportUploadView.as_view(), name="imports-upload"),
    path("imports/historique/", ImportHistoryView.as_view(), name="imports-historique"),
    path("mails/apercu/", MailApercuView.as_view(), name="mails-apercu"),
    path("mails/envoyer/", MailEnvoyerView.as_view(), name="mails-envoyer"),
    path("mails/historique/", MailHistoriqueView.as_view(), name="mails-historique"),
    path("config/", ConfigView.as_view(), name="config"),
]
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `docker compose exec backend python manage.py test core`
Expected: `Ran 4 tests ... OK`.

- [ ] **Step 6: Commit**

```bash
git add backend/core/views.py backend/core/urls.py backend/core/tests.py
git commit -m "feat(mails): add filterable mail history endpoint"
```

---

### Task 10: `POST /api/config/smtp/test/` — SMTP connection test

**Files:**
- Modify: `backend/core/views.py`
- Modify: `backend/core/urls.py`
- Modify: `backend/core/tests.py`

**Interfaces:**
- Produces: `POST /api/config/smtp/test/` — `{"status": "ok"}` on success, `{"status": "erreur", "detail": str}` (400) on failure.

- [ ] **Step 1: Write the failing test**

Append to `backend/core/tests.py`:
```python
from unittest.mock import patch


class SmtpTestApiTests(APITestCase):
    @patch("django.core.mail.backends.smtp.EmailBackend.open")
    def test_smtp_test_success(self, mock_open):
        mock_open.return_value = True
        response = self.client.post("/api/config/smtp/test/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "ok")

    @patch("django.core.mail.backends.smtp.EmailBackend.open")
    def test_smtp_test_failure(self, mock_open):
        mock_open.side_effect = Exception("Connexion refusée")
        response = self.client.post("/api/config/smtp/test/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["status"], "erreur")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec backend python manage.py test core.tests.SmtpTestApiTests`
Expected: FAIL (404).

- [ ] **Step 3: Add the view**

In `backend/core/views.py`, add:
```python
from django.core.mail import get_connection


class SmtpTestView(APIView):
    def post(self, request):
        connection = get_connection(fail_silently=False)
        try:
            connection.open()
            connection.close()
        except Exception as exc:  # noqa: BLE001
            return Response({"status": "erreur", "detail": str(exc)}, status=400)

        return Response({"status": "ok"})
```

- [ ] **Step 4: Wire the url**

In `backend/core/urls.py`, add import and route:
```python
from .views import (
    ConfigView,
    HealthView,
    ImportHistoryView,
    ImportUploadView,
    MailApercuView,
    MailEnvoyerView,
    MailHistoriqueView,
    SmtpTestView,
)

urlpatterns = [
    path("core/health/", HealthView.as_view(), name="health"),
    path("imports/upload/", ImportUploadView.as_view(), name="imports-upload"),
    path("imports/historique/", ImportHistoryView.as_view(), name="imports-historique"),
    path("mails/apercu/", MailApercuView.as_view(), name="mails-apercu"),
    path("mails/envoyer/", MailEnvoyerView.as_view(), name="mails-envoyer"),
    path("mails/historique/", MailHistoriqueView.as_view(), name="mails-historique"),
    path("config/", ConfigView.as_view(), name="config"),
    path("config/smtp/test/", SmtpTestView.as_view(), name="config-smtp-test"),
]
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `docker compose exec backend python manage.py test core`
Expected: `Ran 6 tests ... OK`.

- [ ] **Step 6: Commit**

```bash
git add backend/core/views.py backend/core/urls.py backend/core/tests.py
git commit -m "feat(config): add SMTP connection test endpoint"
```

---

### Task 11: Frontend — Automatisations page (rule CRUD + run/test)

**Files:**
- Modify: `frontend/src/lib/api.js`
- Create: `frontend/src/pages/AutomatisationsPage.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `/api/automatisations/` endpoints (Tasks 3, 6).

- [ ] **Step 1: Add API functions**

In `frontend/src/lib/api.js`, append:
```js
export async function fetchRegles() {
  const { data } = await api.get('/api/automatisations/')
  return data
}

export async function createRegle(payload) {
  const { data } = await api.post('/api/automatisations/', payload)
  return data
}

export async function updateRegle(id, payload) {
  const { data } = await api.put(`/api/automatisations/${id}/`, payload)
  return data
}

export async function deleteRegle(id) {
  await api.delete(`/api/automatisations/${id}/`)
}

export async function runRegle(id) {
  const { data } = await api.post(`/api/automatisations/${id}/run/`)
  return data
}

export async function testRegle(id) {
  const { data } = await api.post(`/api/automatisations/${id}/test/`)
  return data
}
```

- [ ] **Step 2: Create the page**

`frontend/src/pages/AutomatisationsPage.jsx`:
```jsx
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createRegle,
  deleteRegle,
  fetchRegles,
  runRegle,
  testRegle,
} from '../lib/api'

const emptyForm = {
  nom: '',
  delais_jours: '45,20,7',
  departements_filtre: '',
  destinataires: '',
  cc: '',
  bcc: '',
  prompt_override: '',
}

function toList(value) {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

export default function AutomatisationsPage() {
  const [form, setForm] = useState(emptyForm)
  const [feedback, setFeedback] = useState('')
  const queryClient = useQueryClient()

  const reglesQuery = useQuery({ queryKey: ['regles'], queryFn: fetchRegles })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['regles'] })

  const createMutation = useMutation({
    mutationFn: createRegle,
    onSuccess: () => {
      setForm(emptyForm)
      invalidate()
    },
  })

  const deleteMutation = useMutation({ mutationFn: deleteRegle, onSuccess: invalidate })

  const runMutation = useMutation({
    mutationFn: runRegle,
    onSuccess: (data) => setFeedback(`${data.length} alerte(s) envoyée(s).`),
  })

  const testMutation = useMutation({
    mutationFn: testRegle,
    onSuccess: (data) => setFeedback(`Test envoyé — statut: ${data.status}.`),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    createMutation.mutate({
      nom: form.nom,
      delais_jours: toList(form.delais_jours).map(Number),
      departements_filtre: toList(form.departements_filtre),
      destinataires: toList(form.destinataires),
      cc: toList(form.cc),
      bcc: toList(form.bcc),
      prompt_override: form.prompt_override,
    })
  }

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Automatisations</h1>
        <p className="text-gray-500 mt-1">
          Règles d'alerte de contrats expirants — délais en jours (ex: 45,20,7).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 border border-gray-200 rounded-lg p-4">
        <input
          className="border border-gray-300 rounded-md px-3 py-2 text-sm col-span-2"
          placeholder="Nom de la règle"
          value={form.nom}
          onChange={(e) => setForm({ ...form, nom: e.target.value })}
        />
        <input
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          placeholder="Délais (jours), séparés par virgule"
          value={form.delais_jours}
          onChange={(e) => setForm({ ...form, delais_jours: e.target.value })}
        />
        <input
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          placeholder="Départements filtrés (optionnel)"
          value={form.departements_filtre}
          onChange={(e) => setForm({ ...form, departements_filtre: e.target.value })}
        />
        <input
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          placeholder="Destinataires (emails ou departement:X)"
          value={form.destinataires}
          onChange={(e) => setForm({ ...form, destinataires: e.target.value })}
        />
        <input
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          placeholder="CC"
          value={form.cc}
          onChange={(e) => setForm({ ...form, cc: e.target.value })}
        />
        <input
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          placeholder="BCC"
          value={form.bcc}
          onChange={(e) => setForm({ ...form, bcc: e.target.value })}
        />
        <textarea
          className="border border-gray-300 rounded-md px-3 py-2 text-sm col-span-2"
          placeholder="Prompt personnalisé (optionnel — variables: {{nom}} {{departement}} {{date_fin}} {{jours_restants}})"
          value={form.prompt_override}
          onChange={(e) => setForm({ ...form, prompt_override: e.target.value })}
        />
        <button
          type="submit"
          disabled={createMutation.isPending || !form.nom}
          className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50 col-span-2"
        >
          {createMutation.isPending ? 'Création…' : 'Créer la règle'}
        </button>
      </form>

      {feedback && <p className="text-sm text-gray-600">{feedback}</p>}

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="py-2 pr-4">Nom</th>
            <th className="py-2 pr-4">Délais</th>
            <th className="py-2 pr-4">Actif</th>
            <th className="py-2 pr-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {reglesQuery.data?.map((regle) => (
            <tr key={regle.id} className="border-b border-gray-100">
              <td className="py-2 pr-4">{regle.nom}</td>
              <td className="py-2 pr-4">{regle.delais_jours.join(', ')}</td>
              <td className="py-2 pr-4">{regle.actif ? 'Oui' : 'Non'}</td>
              <td className="py-2 pr-4 space-x-2">
                <button
                  className="text-gray-700 hover:underline"
                  onClick={() => runMutation.mutate(regle.id)}
                >
                  Exécuter
                </button>
                <button
                  className="text-gray-700 hover:underline"
                  onClick={() => testMutation.mutate(regle.id)}
                >
                  Tester
                </button>
                <button
                  className="text-red-600 hover:underline"
                  onClick={() => deleteMutation.mutate(regle.id)}
                >
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
          {reglesQuery.data?.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-gray-400 text-center">Aucune règle configurée.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Add the route**

In `frontend/src/App.jsx`, modify imports and routes:
```jsx
import { NavLink, Route, Routes } from 'react-router-dom'
import AutomatisationsPage from './pages/AutomatisationsPage'
import ImportsPage from './pages/ImportsPage'
import MailApercuPage from './pages/MailApercuPage'
```
```jsx
      <nav className="border-b border-gray-200 bg-white px-6 py-3 flex gap-2">
        <NavLink to="/" end className={linkClass}>Dashboard</NavLink>
        <NavLink to="/imports" className={linkClass}>Imports</NavLink>
        <NavLink to="/automatisations" className={linkClass}>Automatisations</NavLink>
        <NavLink to="/mails/apercu" className={linkClass}>Aperçu mail</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/imports" element={<ImportsPage />} />
        <Route path="/automatisations" element={<AutomatisationsPage />} />
        <Route path="/mails/apercu" element={<MailApercuPage />} />
      </Routes>
```

- [ ] **Step 4: Manual smoke test**

Run: `docker compose up -d` then open `http://localhost:5173/automatisations` in a browser. Create a rule, click "Tester", confirm the feedback line shows a status.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.js frontend/src/pages/AutomatisationsPage.jsx frontend/src/App.jsx
git commit -m "feat(frontend): add Automatisations page for rule management"
```

---

### Task 12: Frontend — mail history page + preview/edit/send flow

**Files:**
- Modify: `frontend/src/lib/api.js`
- Create: `frontend/src/pages/MailsHistoriquePage.jsx`
- Modify: `frontend/src/pages/MailApercuPage.jsx`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `/api/mails/historique/`, `/api/mails/envoyer/`, `/api/config/smtp/test/` (Tasks 8-10).

- [ ] **Step 1: Add API functions**

In `frontend/src/lib/api.js`, append:
```js
export async function fetchMailHistorique(params = {}) {
  const { data } = await api.get('/api/mails/historique/', { params })
  return data
}

export async function envoyerMail({ mailLogId, subject, body }) {
  const { data } = await api.post('/api/mails/envoyer/', {
    mail_log_id: mailLogId,
    subject,
    body,
  })
  return data
}

export async function testerSmtp() {
  const { data } = await api.post('/api/config/smtp/test/')
  return data
}
```

- [ ] **Step 2: Create the history page**

`frontend/src/pages/MailsHistoriquePage.jsx`:
```jsx
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { fetchMailHistorique, testerSmtp } from '../lib/api'

function StatusBadge({ status }) {
  const styles = {
    SENT: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
    DRAFT: 'bg-yellow-100 text-yellow-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] || ''}`}>
      {status}
    </span>
  )
}

export default function MailsHistoriquePage() {
  const [statut, setStatut] = useState('')

  const historyQuery = useQuery({
    queryKey: ['mails-historique', statut],
    queryFn: () => fetchMailHistorique(statut ? { statut } : {}),
  })

  const smtpTestMutation = useMutation({ mutationFn: testerSmtp })

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Historique des mails</h1>
          <p className="text-gray-500 mt-1">Envois automatiques et manuels.</p>
        </div>
        <button
          onClick={() => smtpTestMutation.mutate()}
          className="border border-gray-300 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100"
        >
          {smtpTestMutation.isPending ? 'Test en cours…' : 'Tester la connexion SMTP'}
        </button>
      </div>

      {smtpTestMutation.isSuccess && (
        <p className="text-green-700 text-sm">Connexion SMTP OK.</p>
      )}
      {smtpTestMutation.isError && (
        <p className="text-red-600 text-sm">
          {smtpTestMutation.error?.response?.data?.detail || 'Échec du test SMTP.'}
        </p>
      )}

      <select
        className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        value={statut}
        onChange={(e) => setStatut(e.target.value)}
      >
        <option value="">Tous les statuts</option>
        <option value="SENT">Envoyé</option>
        <option value="FAILED">Échec</option>
        <option value="DRAFT">Brouillon</option>
      </select>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="py-2 pr-4">Date</th>
            <th className="py-2 pr-4">Sujet</th>
            <th className="py-2 pr-4">Statut</th>
            <th className="py-2 pr-4">Erreur</th>
          </tr>
        </thead>
        <tbody>
          {historyQuery.data?.map((row) => (
            <tr key={row.id} className="border-b border-gray-100">
              <td className="py-2 pr-4">{new Date(row.created_at).toLocaleString('fr-FR')}</td>
              <td className="py-2 pr-4">{row.subject || row.sujet_demande}</td>
              <td className="py-2 pr-4"><StatusBadge status={row.status} /></td>
              <td className="py-2 pr-4 text-red-600">{row.erreur}</td>
            </tr>
          ))}
          {historyQuery.data?.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-gray-400 text-center">Aucun mail pour le moment.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Extend `MailApercuPage` with edit + send + regenerate**

In `frontend/src/pages/MailApercuPage.jsx`, modify imports and add state/mutation:
```jsx
import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { envoyerMail, fetchEmployees, generateMailApercu } from '../lib/api'
```

Replace the `MailApercuPage` function body's result-rendering section (the block starting at `const result = apercuMutation.data`) with:
```jsx
  const [editedSubject, setEditedSubject] = useState('')
  const [editedBody, setEditedBody] = useState('')

  const result = apercuMutation.data

  useEffect(() => {
    if (result?.status === 'DRAFT') {
      setEditedSubject(result.subject)
      setEditedBody(result.body)
    }
  }, [result])

  const envoyerMutation = useMutation({
    mutationFn: envoyerMail,
  })

  const handleRegenerer = () => {
    if (!employeeId || !sujetDemande) return
    apercuMutation.mutate({ employeeId, sujetDemande })
  }

  const handleEnvoyer = () => {
    if (!result?.id) return
    envoyerMutation.mutate({ mailLogId: result.id, subject: editedSubject, body: editedBody })
  }
```

Then replace the final preview block:
```jsx
      {result && result.status === 'FAILED' && (
        <p className="text-red-600 text-sm">{result.erreur}</p>
      )}

      {result && result.status === 'DRAFT' && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Objet</label>
            <input
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={editedSubject}
              onChange={(e) => setEditedSubject(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Corps</label>
            <textarea
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm min-h-[160px]"
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRegenerer}
              disabled={apercuMutation.isPending}
              className="border border-gray-300 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-100"
            >
              Régénérer via Ollama
            </button>
            <button
              onClick={handleEnvoyer}
              disabled={envoyerMutation.isPending}
              className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
            >
              {envoyerMutation.isPending ? 'Envoi…' : 'Envoyer'}
            </button>
          </div>
          {envoyerMutation.isSuccess && (
            <p className="text-green-700 text-sm">
              Statut: {envoyerMutation.data.status === 'SENT' ? 'Envoyé' : envoyerMutation.data.status}
            </p>
          )}
          {envoyerMutation.isError && (
            <p className="text-red-600 text-sm">
              {envoyerMutation.error?.response?.data?.detail || "Échec de l'envoi."}
            </p>
          )}
        </div>
      )}
```

- [ ] **Step 4: Add the route**

In `frontend/src/App.jsx`, add import and route:
```jsx
import MailsHistoriquePage from './pages/MailsHistoriquePage'
```
```jsx
        <NavLink to="/mails/apercu" className={linkClass}>Aperçu mail</NavLink>
        <NavLink to="/mails/historique" className={linkClass}>Historique mails</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/imports" element={<ImportsPage />} />
        <Route path="/automatisations" element={<AutomatisationsPage />} />
        <Route path="/mails/apercu" element={<MailApercuPage />} />
        <Route path="/mails/historique" element={<MailsHistoriquePage />} />
      </Routes>
```

- [ ] **Step 5: Manual smoke test**

Run: `docker compose up -d`, open `http://localhost:5173/mails/apercu`, generate a preview, edit the subject/body, click "Envoyer", confirm a success/failure message appears. Then open `http://localhost:5173/mails/historique` and confirm the sent mail appears in the table.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/api.js frontend/src/pages/MailsHistoriquePage.jsx frontend/src/pages/MailApercuPage.jsx frontend/src/App.jsx
git commit -m "feat(frontend): add mail history page and preview/edit/send flow"
```

---

### Task 13: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Document the new apps and endpoints**

In `CLAUDE.md`, in the `## Architecture` section, after the `employees app models` paragraph, add:
```markdown
**automatisations app**: `RegleAutomatisation` (delay list, department filter, destinataires/cc/bcc — the latter as emails or `departement:<nom>` aliases resolved at send time, prompt override) and `AlerteEnvoyee` (dedup ledger, unique on `regle`+`contract`+`delai_jours`). `automatisations/services.py` has `evaluer_regles()` (matches contracts to rule delays, generates+sends via Ollama/SMTP, records `AlerteEnvoyee`) and `generer_rapport_quotidien()` — both scheduled daily at 9h/9h05 in `integrations/scheduler.py`, and also callable manually via `POST /api/automatisations/:id/run/` and `/test/` (test skips the dedup ledger).

**Mail sending (E4)**: `core.models.MailLog` (extended in Sprint 3 with `cc`/`bcc`/`format`/`regle`) is the shared record for both automated and manual sends. Manual flow: `POST /api/mails/apercu/` (Ollama draft, no send) → user edits in UI → `POST /api/mails/envoyer/` (sends edited content, updates `MailLog`). `GET /api/mails/historique/` lists all sends (filters: `statut`, `employee`, `date`). `POST /api/config/smtp/test/` opens/closes an SMTP connection using `.env` credentials without sending mail.
```

Also update the reconciliation note added earlier — the `automatisations` app now exists; remove `automatisations` from the "not yet reconciled" list. In `CLAUDE.md`, modify:
```markdown
Note: v3/v4 assume a more granular Django app split (`imports`, `automatisations`, `mails`, `llm`, `agents`, `n8n_integration`, `notifications`, `dashboard`) than what currently exists (`core`, `employees`, `agents`, `integrations`) — not yet reconciled.
```
to:
```markdown
Note: v3/v4 assume a more granular Django app split (`imports`, `mails`, `llm`, `n8n_integration`, `notifications`, `dashboard`) than what currently exists — `automatisations` was split out in Sprint 3; mail sending stayed in `core` (`MailLog`) rather than a separate `mails` app since it predates this reconciliation. Not fully reconciled yet.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document automatisations app and mail sending flow in CLAUDE.md"
```

---

## Self-Review Notes

- **Spec coverage**: US-E3 delay-based alerts (Task 5), department filter (Task 5), prompt override with `{{nom}}`/`{{departement}}`/`{{date_fin}}`/`{{jours_restants}}` (Task 5), daily 9h report (Tasks 5/7), manual run (Task 6), configurable destinataires/cc/bcc (Tasks 1, 5, 11) all covered. US-E4 preview/edit (Task 12, reusing existing `MailApercuView`), regenerate via Ollama (Task 12), SMTP test (Task 10) all covered. `format` field exists on `MailLog` (Task 4) for future HTML/texte rendering choice, though rich HTML template rendering itself is explicitly out of scope per the design doc.
- **Deviation flagged**: the plan does not create a `mails` app as the original design doc specified, because `core.MailLog` and `mails/apercu/` already existed at planning time — see Global Constraints.
- **Type consistency checked**: `evaluer_regles(regle_id=None) -> list[MailLog]` (Task 5) matches its use in `RegleRunView` (Task 6) and the scheduler (Task 7, called with no args for the full sweep). `_envoyer_alerte(regle, contract, jours_restants, marquer_alerte=True)` (Task 5) matches its use in `RegleTestView` (Task 6, `marquer_alerte=False`). `MailLogSerializer` fields (Task 4) match what `RegleRunView`/`RegleTestView`/`MailEnvoyerView`/`MailHistoriqueView` serialize.
