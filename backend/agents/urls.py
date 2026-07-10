from django.urls import path

from .views import (
    AgentAnalyseListView,
    AgentConfigView,
    AnalyseLancerView,
    ConversationListView,
    ConversationMessagesView,
    HealthView,
    ModelesDisponiblesView,
    SuggestionsView,
    WorkflowDefinitionsView,
    WorkflowExecutionListView,
    WorkflowLancerView,
    WorkflowPersonnaliseView,
    WorkflowRepriseView,
)

app_name = "agents"

urlpatterns = [
    path("agents/health/", HealthView.as_view(), name="health"),
    path("agents/analyses/", AgentAnalyseListView.as_view(), name="analyses-list"),
    path("agents/analyses/lancer/", AnalyseLancerView.as_view(), name="analyses-lancer"),
    path("agents/config/", AgentConfigView.as_view(), name="config"),
    path("agents/config/modeles-disponibles/", ModelesDisponiblesView.as_view(), name="modeles-disponibles"),
    path("agents/chat/suggestions/", SuggestionsView.as_view(), name="chat-suggestions"),
    path("agents/chat/conversations/", ConversationListView.as_view(), name="conversations-list"),
    path("agents/chat/conversations/<int:pk>/messages/", ConversationMessagesView.as_view(), name="conversation-messages"),
    path("agents/workflows/", WorkflowDefinitionsView.as_view(), name="workflows-definitions"),
    path("agents/workflows/lancer/", WorkflowLancerView.as_view(), name="workflows-lancer"),
    path("agents/workflows/personnalise/", WorkflowPersonnaliseView.as_view(), name="workflows-personnalise"),
    path("agents/workflows/executions/", WorkflowExecutionListView.as_view(), name="workflows-executions"),
    path("agents/workflows/executions/<int:pk>/reprendre/", WorkflowRepriseView.as_view(), name="workflows-reprendre"),
]
