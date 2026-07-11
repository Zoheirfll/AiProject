from rest_framework import serializers

from .models import ExcelImport, MailLog, TechnicalLog


class ExcelImportSerializer(serializers.ModelSerializer):
    cree_par_username = serializers.CharField(source="cree_par.username", read_only=True, default=None)

    class Meta:
        model = ExcelImport
        fields = [
            "id",
            "fichier",
            "nom_fichier_origine",
            "source",
            "status",
            "lignes_total",
            "lignes_importees",
            "lignes_erreurs",
            "erreurs",
            "cree_par_username",
            "created_at",
        ]
        read_only_fields = fields


class MailLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = MailLog
        fields = [
            "id",
            "employee",
            "destinataire_nom",
            "destinataire_email",
            "regle",
            "sujet_demande",
            "subject",
            "body",
            "format",
            "cc",
            "bcc",
            "status",
            "erreur",
            "created_at",
            "sent_at",
        ]
        read_only_fields = ["status", "erreur", "created_at", "sent_at"]


class TechnicalLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = TechnicalLog
        fields = ["id", "created_at", "level", "logger_name", "message"]
        read_only_fields = fields
