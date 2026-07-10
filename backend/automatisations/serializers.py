from rest_framework import serializers

from .models import (
    AlerteEnvoyee,
    AutomatisationConfig,
    ExecutionSurveillance,
    RegleAutomatisation,
    TacheSurveillance,
)


class AutomatisationConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomatisationConfig
        fields = ["prompt_global", "heure_rapport_quotidien", "dernier_rapport_envoye"]
        read_only_fields = ["dernier_rapport_envoye"]


class AlerteEnvoyeeSerializer(serializers.ModelSerializer):
    employee_nom = serializers.SerializerMethodField()
    date_fin = serializers.DateField(source="contract.date_fin", read_only=True)

    class Meta:
        model = AlerteEnvoyee
        fields = ["id", "contract", "employee_nom", "date_fin", "delai_jours", "date_envoi"]
        read_only_fields = fields

    def get_employee_nom(self, obj):
        return f"{obj.contract.employee.prenom} {obj.contract.employee.nom}"


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


class TacheSurveillanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = TacheSurveillance
        fields = [
            "id",
            "nom",
            "actif",
            "fichier",
            "frequence",
            "heure_quotidienne",
            "prompt_analyse",
            "mode_envoi",
            "destinataires",
            "cc",
            "bcc",
            "derniere_execution",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["derniere_execution", "created_at", "updated_at"]


class ExecutionSurveillanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExecutionSurveillance
        fields = ["id", "tache", "envoye", "resume", "executed_at"]
        read_only_fields = fields
