from django.test import TestCase

from .models import MailLog


class MailLogModelTests(TestCase):
    def test_new_fields_default(self):
        mail_log = MailLog.objects.create(sujet_demande="Test")
        self.assertEqual(mail_log.cc, [])
        self.assertEqual(mail_log.bcc, [])
        self.assertEqual(mail_log.format, MailLog.Format.TEXTE)
        self.assertIsNone(mail_log.regle)
