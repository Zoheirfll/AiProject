from django.contrib import admin

from .models import AgentAnalyse, ChatConversation, ChatMessage, WorkflowExecution


@admin.register(AgentAnalyse)
class AgentAnalyseAdmin(admin.ModelAdmin):
    list_display = ["id", "excel_import", "alertes_envoyees", "created_at"]


@admin.register(ChatConversation)
class ChatConversationAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "titre", "updated_at"]


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ["id", "conversation", "role", "created_at"]


@admin.register(WorkflowExecution)
class WorkflowExecutionAdmin(admin.ModelAdmin):
    list_display = ["id", "nom", "type_workflow", "statut", "cree_par", "created_at"]
