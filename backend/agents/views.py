from django.shortcuts import get_object_or_404
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsDRH

from .analyste import analyser_import
from .models import AgentAnalyse, AgentConfig, ChatConversation, WorkflowExecution
from .ollama_client import OllamaGenerationError, _client
from .outils import SUGGESTIONS
from .serializers import (
    AgentAnalyseSerializer,
    AgentConfigSerializer,
    ChatConversationSerializer,
    ChatMessageSerializer,
    WorkflowExecutionSerializer,
)
from .workflows import (
    WORKFLOW_DEFINITIONS,
    WORKFLOW_LABELS,
    lancer_workflow,
    planifier_workflow_personnalise,
)


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok", "app": "agents"})


class AgentAnalyseListView(ListAPIView):
    """US-E6-01: past analyste-agent runs, most recent first."""

    queryset = AgentAnalyse.objects.all()
    serializer_class = AgentAnalyseSerializer


class AnalyseLancerView(APIView):
    """Run the analyste agent on-demand — a generic snapshot of all active
    employees (not tied to a specific import)."""

    def post(self, request):
        from employees.serializers import EmployeeSerializer
        from employees.models import Employee

        lignes = [
            {k: v for k, v in EmployeeSerializer(e).data.items() if k != "contracts"}
            for e in Employee.objects.filter(actif=True)
        ]
        analyse = analyser_import(None, lignes=lignes)
        return Response(AgentAnalyseSerializer(analyse).data, status=201)


class AgentConfigView(APIView):
    """US-E6-05: per-agent Ollama model + timeout/iteration limits."""

    permission_classes = [IsDRH]

    def get(self, request):
        return Response(AgentConfigSerializer(AgentConfig.get_solo()).data)

    def put(self, request):
        config = AgentConfig.get_solo()
        serializer = AgentConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ModelesDisponiblesView(APIView):
    """US-E6-05: list of models actually pulled in the local Ollama instance."""

    permission_classes = [IsDRH]

    def get(self, request):
        try:
            result = _client().list()
        except Exception as exc:  # noqa: BLE001
            return Response({"detail": f"Ollama injoignable: {exc}"}, status=503)

        modeles = [m.get("model") or m.get("name") for m in result.get("models", [])]
        return Response({"modeles": [m for m in modeles if m]})


class SuggestionsView(APIView):
    """US-E6-02: frequent-question suggestions shown in the chat UI."""

    def get(self, request):
        return Response({"suggestions": SUGGESTIONS})


class ConversationListView(ListAPIView):
    """US-E6-03: this user's past conversations, most recently updated first."""

    serializer_class = ChatConversationSerializer

    def get_queryset(self):
        return ChatConversation.objects.filter(user=self.request.user)


class ConversationMessagesView(APIView):
    """US-E6-03: full message history for one of this user's conversations."""

    def get(self, request, pk):
        conversation = get_object_or_404(ChatConversation, pk=pk, user=request.user)
        messages = conversation.messages.order_by("created_at")
        return Response(ChatMessageSerializer(messages, many=True).data)


class WorkflowDefinitionsView(APIView):
    """US-E6-04: the predefined workflows available to launch."""

    def get(self, request):
        return Response(
            [{"type_workflow": slug, "nom": WORKFLOW_LABELS[slug], "etapes": etapes}
             for slug, etapes in WORKFLOW_DEFINITIONS.items()]
        )


class WorkflowLancerView(APIView):
    """US-E6-04: launch a predefined workflow (runs synchronously, pushing
    per-step WS notifications for the live stepper)."""

    permission_classes = [IsDRH]

    def post(self, request):
        type_workflow = request.data.get("type_workflow")
        if type_workflow not in WORKFLOW_DEFINITIONS:
            return Response({"detail": "Type de workflow inconnu."}, status=400)

        execution = WorkflowExecution.objects.create(
            type_workflow=type_workflow,
            nom=WORKFLOW_LABELS[type_workflow],
            parametres=request.data.get("parametres") or {},
            cree_par=request.user,
        )
        execution = lancer_workflow(execution)
        return Response(WorkflowExecutionSerializer(execution).data, status=201)


class WorkflowPersonnaliseView(APIView):
    """US-E6-04: describe a workflow in natural language — the model picks
    and orders known step primitives (never arbitrary generated code)."""

    permission_classes = [IsDRH]

    def post(self, request):
        instruction = (request.data.get("instruction") or "").strip()
        if not instruction:
            return Response({"detail": "instruction est requis."}, status=400)

        config = AgentConfig.get_solo()
        try:
            slugs = planifier_workflow_personnalise(instruction, model=config.modele("orchestrateur"))
        except OllamaGenerationError as exc:
            return Response({"detail": str(exc)}, status=400)

        from .workflows import STEP_PRIMITIVES

        execution = WorkflowExecution.objects.create(
            type_workflow=WorkflowExecution.TypeWorkflow.PERSONNALISE,
            nom=instruction[:255],
            parametres=request.data.get("parametres") or {},
            etapes=[
                {"slug": s, "nom": STEP_PRIMITIVES[s][0], "statut": "EN_ATTENTE", "resultat": "", "erreur": ""}
                for s in slugs
            ],
            cree_par=request.user,
        )
        execution = lancer_workflow(execution)
        return Response(WorkflowExecutionSerializer(execution).data, status=201)


class WorkflowExecutionListView(ListAPIView):
    """US-E6-04: history of workflow executions."""

    queryset = WorkflowExecution.objects.all()
    serializer_class = WorkflowExecutionSerializer


class WorkflowRepriseView(APIView):
    """US-E6-04: resume a failed execution from its failed step."""

    permission_classes = [IsDRH]

    def post(self, request, pk):
        execution = get_object_or_404(WorkflowExecution, pk=pk)
        if execution.statut != WorkflowExecution.Statut.ECHEC:
            return Response({"detail": "Ce workflow n'est pas en échec."}, status=400)

        index_echec = next(
            (i for i, e in enumerate(execution.etapes) if e["statut"] == "ECHEC"), None
        )
        if index_echec is None:
            return Response({"detail": "Aucune étape en échec trouvée."}, status=400)

        execution.statut = WorkflowExecution.Statut.EN_COURS
        execution.save(update_fields=["statut"])
        execution = lancer_workflow(execution, reprise_depuis=index_echec)
        return Response(WorkflowExecutionSerializer(execution).data, status=200)
