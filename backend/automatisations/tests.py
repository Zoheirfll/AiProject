from datetime import date, timedelta
from unittest.mock import patch

from django.core import mail
from django.db.utils import IntegrityError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from core.models import MailLog
from employees.models import Contract, Employee

from .models import AlerteEnvoyee, RegleAutomatisation
from .services import evaluer_regles


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

    @patch("automatisations.services.generate_mail_content")
    def test_does_not_resend_within_dedup_window(self, mock_generate):
        mock_generate.return_value = {"subject": "S", "body": "B"}
        evaluer_regles()
        mail.outbox.clear()

        resultats = evaluer_regles()

        self.assertEqual(resultats, [])
        self.assertEqual(len(mail.outbox), 0)
