from datetime import date

from django.db.utils import IntegrityError
from django.test import TestCase

from employees.models import Contract, Employee

from .models import AlerteEnvoyee, RegleAutomatisation


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
