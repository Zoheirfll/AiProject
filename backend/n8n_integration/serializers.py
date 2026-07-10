from rest_framework import serializers

from employees.models import Contract


class ContratExpirantSerializer(serializers.ModelSerializer):
    employee_id = serializers.IntegerField(source="employee.id")
    matricule = serializers.CharField(source="employee.matricule")
    nom = serializers.CharField(source="employee.nom")
    prenom = serializers.CharField(source="employee.prenom")
    email = serializers.EmailField(source="employee.email")
    departement = serializers.CharField(source="employee.departement")
    jours_restants = serializers.SerializerMethodField()

    class Meta:
        model = Contract
        fields = [
            "id", "employee_id", "matricule", "nom", "prenom", "email",
            "departement", "type", "date_fin", "jours_restants",
        ]

    def get_jours_restants(self, obj):
        from django.utils import timezone

        return (obj.date_fin - timezone.localdate()).days
