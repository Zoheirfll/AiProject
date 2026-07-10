from django.test import TestCase

from .models import RegleAutomatisation


class RegleAutomatisationModelTests(TestCase):
    def test_defaults(self):
        regle = RegleAutomatisation.objects.create(nom="Alerte contrats CDD")
        self.assertTrue(regle.actif)
        self.assertEqual(regle.delais_jours, [])
        self.assertEqual(regle.destinataires, [])
        self.assertEqual(str(regle), "Alerte contrats CDD")
