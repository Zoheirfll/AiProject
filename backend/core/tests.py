import io
from unittest.mock import patch

import openpyxl
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APITestCase

from accounts.test_utils import make_user
from employees.models import Employee

from .models import ExcelImport, MailLog


class MailLogModelTests(TestCase):
    def test_new_fields_default(self):
        mail_log = MailLog.objects.create(sujet_demande="Test")
        self.assertEqual(mail_log.cc, [])
        self.assertEqual(mail_log.bcc, [])
        self.assertEqual(mail_log.format, MailLog.Format.TEXTE)
        self.assertIsNone(mail_log.regle)


class MailApercuAdHocApiTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(user=make_user())

    @patch("core.views.generate_mail_content")
    def test_apercu_without_employee_uses_destinataire_email(self, mock_generate):
        mock_generate.return_value = {"subject": "S", "body": "B"}

        response = self.client.post(
            "/api/mails/apercu/",
            {
                "destinataire_nom": "Fournisseur Test",
                "destinataire_email": "fournisseur@example.com",
                "sujet_demande": "Demande de devis",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], "DRAFT")
        self.assertIsNone(response.data["employee"])
        self.assertEqual(response.data["destinataire_email"], "fournisseur@example.com")

    def test_apercu_without_employee_or_destinataire_email_fails(self):
        response = self.client.post(
            "/api/mails/apercu/", {"sujet_demande": "Demande de devis"}, format="json",
        )
        self.assertEqual(response.status_code, 400)


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class MailEnvoyerApiTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(user=make_user())

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

    def test_envoyer_sends_to_ad_hoc_destinataire_without_employee(self):
        mail_log = MailLog.objects.create(
            destinataire_nom="Fournisseur Test",
            destinataire_email="fournisseur@example.com",
            sujet_demande="Devis",
            subject="Sujet",
            body="Corps",
        )

        response = self.client.post(
            "/api/mails/envoyer/", {"mail_log_id": mail_log.id}, format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "SENT")
        self.assertEqual(mail.outbox[0].to, ["fournisseur@example.com"])

    def test_envoyer_requires_employee_email(self):
        employee = Employee.objects.create(matricule="M011", nom="Sadi", prenom="Lina", email="")
        mail_log = MailLog.objects.create(employee=employee, sujet_demande="Rappel")

        response = self.client.post(
            "/api/mails/envoyer/", {"mail_log_id": mail_log.id}, format="json",
        )
        self.assertEqual(response.status_code, 400)


class MailHistoriqueApiTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(user=make_user())

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
    def setUp(self):
        self.client.force_authenticate(user=make_user())

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


def _build_xlsx(rows):
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    for row in rows:
        sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return buffer.read()


@patch("agents.analyste.analyser_document")
class ImportUploadApiTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(user=make_user())

    def test_missing_required_columns_is_reported_as_failed(self, mock_analyser):
        content = _build_xlsx([["colonne_inconnue"], ["valeur"]])
        upload = SimpleUploadedFile(
            "employes.xlsx", content, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        response = self.client.post("/api/imports/upload/", {"fichier": upload}, format="multipart")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], "FAILED")
        self.assertEqual(response.data["lignes_erreurs"], 1)
        self.assertEqual(ExcelImport.objects.get(pk=response.data["id"]).status, ExcelImport.Status.FAILED)

    def test_valid_rows_are_reported_as_success(self, mock_analyser):
        mock_analyser.return_value = {"envoyer": False, "subject": "", "body": ""}
        content = _build_xlsx([
            ["matricule", "nom", "prenom"],
            ["M100", "Dupont", "Jean"],
        ])
        upload = SimpleUploadedFile(
            "employes.xlsx", content, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        response = self.client.post("/api/imports/upload/", {"fichier": upload}, format="multipart")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], "SUCCESS")
        self.assertEqual(response.data["lignes_importees"], 1)


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class MailMasseApiTests(APITestCase):
    def setUp(self):
        self.client.force_authenticate(user=make_user())

    @patch("core.views.generate_mail_content")
    def test_apercu_masse_generates_one_draft_per_row(self, mock_generate):
        mock_generate.return_value = {"subject": "S", "body": "B"}
        content = _build_xlsx([
            ["nom", "email", "sujet"],
            ["Fournisseur A", "a@example.com", "Relance facture"],
            ["Fournisseur B", "b@example.com", ""],
        ])
        upload = SimpleUploadedFile(
            "masse.xlsx", content, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        response = self.client.post(
            "/api/mails/apercu-masse/",
            {"fichier": upload, "sujet_demande": "Sujet par défaut"},
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data["drafts"]), 2)
        self.assertEqual(mock_generate.call_count, 2)
        self.assertEqual(response.data["drafts"][0]["destinataire_email"], "a@example.com")
        self.assertEqual(response.data["drafts"][0]["status"], "DRAFT")

    def test_apercu_masse_requires_email_column(self):
        content = _build_xlsx([["nom", "sujet"], ["A", "S"]])
        upload = SimpleUploadedFile(
            "masse.xlsx", content, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        response = self.client.post(
            "/api/mails/apercu-masse/", {"fichier": upload}, format="multipart",
        )

        self.assertEqual(response.status_code, 400)

    def test_envoyer_masse_sends_each_draft(self):
        m1 = MailLog.objects.create(
            destinataire_email="a@example.com", sujet_demande="S", subject="Sujet A", body="Corps A",
        )
        m2 = MailLog.objects.create(
            destinataire_email="b@example.com", sujet_demande="S", subject="Sujet B", body="Corps B",
        )

        response = self.client.post(
            "/api/mails/envoyer-masse/",
            {"mails": [{"mail_log_id": m1.id}, {"mail_log_id": m2.id}]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        self.assertTrue(all(r["status"] == "SENT" for r in response.data))
        self.assertEqual(len(mail.outbox), 2)
