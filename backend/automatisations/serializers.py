from rest_framework import serializers

from core.services import fichier_trop_volumineux

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
    date_fin = serializers.SerializerMethodField()

    class Meta:
        model = AlerteEnvoyee
        fields = ["id", "contract", "employee_nom", "date_fin", "delai_jours", "cle_dedup", "date_envoi"]
        read_only_fields = fields

    def get_employee_nom(self, obj):
        if obj.employee_id:
            return f"{obj.employee.prenom} {obj.employee.nom}"
        if obj.contract_id:
            return f"{obj.contract.employee.prenom} {obj.contract.employee.nom}"
        return obj.cle_dedup

    def get_date_fin(self, obj):
        return obj.contract.date_fin if obj.contract_id else None


class RegleAutomatisationSerializer(serializers.ModelSerializer):
    cree_par_username = serializers.CharField(source="cree_par.username", read_only=True, default=None)

    class Meta:
        model = RegleAutomatisation
        fields = [
            "id",
            "nom",
            "actif",
            "type_condition",
            "delais_jours",
            "champ_cible",
            "operateur",
            "valeur_seuil",
            "departements_filtre",
            "destinataires",
            "cc",
            "bcc",
            "prompt_override",
            "format",
            "cree_par",
            "cree_par_username",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["cree_par", "created_at", "updated_at"]


class TacheSurveillanceSerializer(serializers.ModelSerializer):
    cree_par_username = serializers.CharField(source="cree_par.username", read_only=True, default=None)

    def validate_fichier(self, value):
        if value and fichier_trop_volumineux(value):
            raise serializers.ValidationError("Fichier trop volumineux (max 10 Mo).")
        return value

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
            "cree_par",
            "cree_par_username",
            "derniere_execution",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["cree_par", "derniere_execution", "created_at", "updated_at"]


class ExecutionSurveillanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExecutionSurveillance
        fields = ["id", "tache", "envoye", "resume", "executed_at"]
        read_only_fields = fields
