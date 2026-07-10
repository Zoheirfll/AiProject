from rest_framework import serializers

from .models import RegleAutomatisation


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
