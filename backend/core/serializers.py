from rest_framework import serializers

from .models import ExcelImport, MailLog


class ExcelImportSerializer(serializers.ModelSerializer):
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
