from rest_framework import serializers

from .models import ExecutionSurveillance, RegleAutomatisation, TacheSurveillance


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
