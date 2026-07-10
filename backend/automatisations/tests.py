from datetime import date, datetime, time, timedelta
from unittest.mock import patch

from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db.utils import IntegrityError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from agents.ollama_client import OllamaGenerationError
from core.models import MailLog
from employees.models import Contract, Employee

from .models import AlerteEnvoyee, ExecutionSurveillance, RegleAutomatisation, TacheSurveillance
from .services import _executer_tache, _tache_est_due, evaluer_regles, evaluer_taches_surveillance


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


class RegleAutomatisationModelTests(TestCase):
    def test_defaults(self):
        regle = RegleAutomatisation.objects.create(nom="Alerte contrats CDD")
        self.assertTrue(regle.actif)
        self.assertEqual(regle.delais_jours, [])
        self.assertEqual(regle.destinataires, [])
        self.assertEqual(str(regle), "Alerte contrats CDD")


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

    @patch("automatisations.services._envoyer_alerte")
    def test_isolates_per_contract_errors(self, mock_envoyer_alerte):
        other_employee = Employee.objects.create(
            matricule="M003", nom="Haddad", prenom="Amel",
            email="amel@example.com", departement="IT",
        )
        today = timezone.localdate()
        other_contract = Contract.objects.create(
            employee=other_employee, type=Contract.Type.CDD,
            date_debut=date(2026, 1, 1), date_fin=today + timedelta(days=7),
        )
        success_log = MailLog.objects.create(
            employee=other_employee, regle=self.regle, sujet_demande="ok",
            status=MailLog.Status.SENT,
        )
        mock_envoyer_alerte.side_effect = [RuntimeError("boom"), success_log]

        resultats = evaluer_regles()

        self.assertEqual(mock_envoyer_alerte.call_count, 2)
        self.assertEqual(resultats, [success_log])
        self.assertFalse(
            AlerteEnvoyee.objects.filter(
                regle=self.regle, contract=self.contract, delai_jours=7
            ).exists()
        )

    @patch("automatisations.services.generate_mail_content")
    def test_does_not_resend_within_dedup_window(self, mock_generate):
        mock_generate.return_value = {"subject": "S", "body": "B"}
        evaluer_regles()
        mail.outbox.clear()

        resultats = evaluer_regles()

        self.assertEqual(resultats, [])
        self.assertEqual(len(mail.outbox), 0)


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


def _make_tache(**kwargs):
    contenu = kwargs.pop("contenu", b"ligne1,ligne2\nvaleur1,valeur2")
    fichier = SimpleUploadedFile("surveillance.csv", contenu, content_type="text/csv")
    defaults = {
        "nom": "Surveillance test",
        "fichier": fichier,
        "prompt_analyse": "Vérifie s'il y a une anomalie.",
        "mode_envoi": TacheSurveillance.ModeEnvoi.ANOMALIE,
        "destinataires": ["watch@example.com"],
    }
    defaults.update(kwargs)
    return TacheSurveillance.objects.create(**defaults)


class TacheEstDueTests(TestCase):
    def test_never_run_is_due_once_past_configured_time(self):
        tache = _make_tache(
            frequence=TacheSurveillance.Frequence.QUOTIDIEN, heure_quotidienne=time(9, 0),
        )
        before = timezone.make_aware(datetime(2026, 1, 2, 8, 0))
        self.assertFalse(_tache_est_due(tache, before))

        after = timezone.make_aware(datetime(2026, 1, 2, 9, 30))
        self.assertTrue(_tache_est_due(tache, after))

    def test_horaire_due_after_one_hour(self):
        tache = _make_tache(frequence=TacheSurveillance.Frequence.HORAIRE)
        now = timezone.now()
        tache.derniere_execution = now - timedelta(minutes=30)
        self.assertFalse(_tache_est_due(tache, now))
        tache.derniere_execution = now - timedelta(hours=1, minutes=1)
        self.assertTrue(_tache_est_due(tache, now))

    def test_quotidien_due_once_per_day_after_configured_time(self):
        tache = _make_tache(
            frequence=TacheSurveillance.Frequence.QUOTIDIEN, heure_quotidienne=time(9, 0),
        )
        now = timezone.make_aware(datetime(2026, 1, 2, 8, 0))
        self.assertFalse(_tache_est_due(tache, now))

        now = timezone.make_aware(datetime(2026, 1, 2, 9, 30))
        self.assertTrue(_tache_est_due(tache, now))

        tache.derniere_execution = timezone.make_aware(datetime(2026, 1, 2, 9, 30))
        self.assertFalse(_tache_est_due(tache, timezone.make_aware(datetime(2026, 1, 2, 23, 0))))
        self.assertTrue(_tache_est_due(tache, timezone.make_aware(datetime(2026, 1, 3, 9, 1))))


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class ExecuterTacheTests(TestCase):
    @patch("automatisations.services.analyser_document")
    def test_sends_when_anomaly_detected(self, mock_analyser):
        mock_analyser.return_value = {"envoyer": True, "subject": "Alerte", "body": "Anomalie trouvée."}
        tache = _make_tache()

        execution = _executer_tache(tache)

        self.assertTrue(execution.envoye)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["watch@example.com"])
        tache.refresh_from_db()
        self.assertIsNotNone(tache.derniere_execution)

    @patch("automatisations.services.analyser_document")
    def test_does_not_send_when_no_anomaly(self, mock_analyser):
        mock_analyser.return_value = {"envoyer": False, "subject": "", "body": "Rien à signaler."}
        tache = _make_tache()

        execution = _executer_tache(tache)

        self.assertFalse(execution.envoye)
        self.assertEqual(len(mail.outbox), 0)

    @patch("automatisations.services.analyser_document")
    def test_toujours_mode_forces_send(self, mock_analyser):
        mock_analyser.return_value = {"envoyer": True, "subject": "Rapport", "body": "Rapport périodique."}
        tache = _make_tache(mode_envoi=TacheSurveillance.ModeEnvoi.TOUJOURS)

        execution = _executer_tache(tache)

        self.assertTrue(execution.envoye)
        mock_analyser.assert_called_once()
        self.assertTrue(mock_analyser.call_args.args[2])  # forcer_envoi=True

    @patch("automatisations.services.analyser_document")
    def test_test_mode_does_not_update_derniere_execution(self, mock_analyser):
        mock_analyser.return_value = {"envoyer": False, "subject": "", "body": "OK"}
        tache = _make_tache()

        _executer_tache(tache, marquer_execution=False)

        tache.refresh_from_db()
        self.assertIsNone(tache.derniere_execution)

    @patch("automatisations.services.analyser_document")
    def test_ollama_failure_is_isolated(self, mock_analyser):
        mock_analyser.side_effect = OllamaGenerationError("indisponible")
        tache = _make_tache()

        execution = _executer_tache(tache)

        self.assertFalse(execution.envoye)
        self.assertIn("Ollama", execution.resume)


class TacheSurveillanceApiTests(APITestCase):
    @patch("automatisations.services.analyser_document")
    def test_run_endpoint_executes_now(self, mock_analyser):
        mock_analyser.return_value = {"envoyer": True, "subject": "S", "body": "B"}
        tache = _make_tache()

        response = self.client.post(f"/api/surveillance/{tache.id}/run/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["envoye"])
        self.assertEqual(ExecutionSurveillance.objects.count(), 1)

    @patch("automatisations.services.analyser_document")
    def test_historique_filters_by_tache(self, mock_analyser):
        mock_analyser.return_value = {"envoyer": False, "subject": "", "body": "OK"}
        tache = _make_tache()
        self.client.post(f"/api/surveillance/{tache.id}/run/")

        response = self.client.get("/api/surveillance/historique/", {"tache": tache.id})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class EvaluerTachesSurveillanceTests(TestCase):
    @patch("automatisations.services.analyser_document")
    def test_skips_task_not_due(self, mock_analyser):
        mock_analyser.return_value = {"envoyer": True, "subject": "S", "body": "B"}
        tache = _make_tache(frequence=TacheSurveillance.Frequence.HORAIRE)
        tache.derniere_execution = timezone.now()
        tache.save()

        resultats = evaluer_taches_surveillance()

        self.assertEqual(resultats, [])
        mock_analyser.assert_not_called()

    @patch("automatisations.services.analyser_document")
    def test_runs_due_task(self, mock_analyser):
        mock_analyser.return_value = {"envoyer": True, "subject": "S", "body": "B"}
        _make_tache(frequence=TacheSurveillance.Frequence.HORAIRE)

        resultats = evaluer_taches_surveillance()

        self.assertEqual(len(resultats), 1)
