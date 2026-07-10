from rest_framework import serializers

from .models import ExcelImport


class ExcelImportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExcelImport
        fields = [
            "id",
            "fichier",
            "status",
            "lignes_total",
            "lignes_importees",
            "lignes_erreurs",
            "erreurs",
            "created_at",
        ]
        read_only_fields = fields
