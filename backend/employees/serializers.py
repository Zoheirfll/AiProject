from rest_framework import serializers

from .models import Contract, Employee


class ContractSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contract
        fields = ["id", "type", "date_debut", "date_fin"]


class EmployeeSerializer(serializers.ModelSerializer):
    contracts = ContractSerializer(many=True, read_only=True)

    class Meta:
        model = Employee
        fields = [
            "id",
            "matricule",
            "nom",
            "prenom",
            "email",
            "departement",
            "poste",
            "categorie",
            "num_contrat",
            "date_fin_contrat",
            "date_embauche",
            "actif",
            "contracts",
        ]
