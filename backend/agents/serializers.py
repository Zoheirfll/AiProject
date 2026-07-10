from rest_framework import serializers

from .models import AgentAnalyse, AgentConfig, ChatConversation, ChatMessage, WorkflowExecution


class AgentConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentConfig
        fields = [
            "modele_analyste",
            "modele_chat",
            "modele_orchestrateur",
            "timeout_secondes",
            "max_iterations",
            "analyste_destinataires",
        ]


class AgentAnalyseSerializer(serializers.ModelSerializer):
    fichier_import = serializers.CharField(source="excel_import.nom_fichier_origine", read_only=True, default=None)

    class Meta:
        model = AgentAnalyse
        fields = ["id", "excel_import", "fichier_import", "resume", "decisions", "alertes_envoyees", "created_at"]
        read_only_fields = fields


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ["id", "role", "content", "outils_utilises", "created_at"]
        read_only_fields = fields


class ChatConversationSerializer(serializers.ModelSerializer):
    dernier_message = serializers.SerializerMethodField()

    class Meta:
        model = ChatConversation
        fields = ["id", "titre", "dernier_message", "created_at", "updated_at"]
        read_only_fields = fields

    def get_dernier_message(self, obj):
        dernier = obj.messages.order_by("-created_at").first()
        return dernier.content[:120] if dernier else ""


class WorkflowExecutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowExecution
        fields = [
            "id",
            "type_workflow",
            "nom",
            "parametres",
            "etapes",
            "statut",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["etapes", "statut", "created_at", "updated_at"]
