from unittest.mock import patch

from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APITestCase

from employees.models import Employee

from .models import MailLog


class MailLogModelTests(TestCase):
    def test_new_fields_default(self):
        mail_log = MailLog.objects.create(sujet_demande="Test")
        self.assertEqual(mail_log.cc, [])
        self.assertEqual(mail_log.bcc, [])
        self.assertEqual(mail_log.format, MailLog.Format.TEXTE)
        self.assertIsNone(mail_log.regle)


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


class MailHistoriqueApiTests(APITestCase):
    def test_filters_by_statut(self):
        employee = Employee.objects.create(matricule="M012", nom="Ziani", prenom="Karim")
        MailLog.objects.create(employee=employee, sujet_demande="A", status=MailLog.Status.SENT)
        MailLog.objects.create(employee=employee, sujet_demande="B", status=MailLog.Status.FAILED)

        response = self.client.get("/api/mails/historique/", {"statut": "sent"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["sujet_demande"], "A")


@override_settings(EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend")
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
