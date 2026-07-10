from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsDRH
from core.serializers import MailLogSerializer
from employees.models import Contract

from .models import AlerteEnvoyee, AutomatisationConfig, ExecutionSurveillance, RegleAutomatisation, TacheSurveillance
from .serializers import (
    AlerteEnvoyeeSerializer,
    AutomatisationConfigSerializer,
    ExecutionSurveillanceSerializer,
    RegleAutomatisationSerializer,
    TacheSurveillanceSerializer,
)
from .services import _envoyer_alerte, _executer_tache, apercu_regle, evaluer_regles


def _regle_visible_qs(user):
    """A Chargé RH only sees rules they created (a recruitment reminder
    shouldn't be visible to a payroll colleague); ownerless legacy rows
    stay visible to everyone; DRH sees everything."""
    qs = RegleAutomatisation.objects.all()
    if user.is_drh:
        return qs
    return qs.filter(Q(cree_par=user) | Q(cree_par__isnull=True))


def _tache_visible_qs(user):
    qs = TacheSurveillance.objects.all()
    if user.is_drh:
        return qs
    return qs.filter(Q(cree_par=user) | Q(cree_par__isnull=True))


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok", "app": "automatisations"})


class RegleListCreateView(ListCreateAPIView):
    serializer_class = RegleAutomatisationSerializer

    def get_queryset(self):
        return _regle_visible_qs(self.request.user)

    def perform_create(self, serializer):
        serializer.save(cree_par=self.request.user)


class RegleDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = RegleAutomatisationSerializer

    def get_queryset(self):
        return _regle_visible_qs(self.request.user)

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [IsDRH()]
        return [IsAuthenticated()]


class RegleRunView(APIView):
    def post(self, request, pk):
        get_object_or_404(_regle_visible_qs(request.user), pk=pk)
        resultats = evaluer_regles(regle_id=pk)
        return Response(MailLogSerializer(resultats, many=True).data, status=200)


class RegleTestView(APIView):
    def post(self, request, pk):
        regle = get_object_or_404(_regle_visible_qs(request.user), pk=pk)
        test_email = (request.data.get("test_email") or "").strip()
        contract = (
            Contract.objects.filter(date_fin__isnull=False)
            .select_related("employee")
            .first()
        )
        if not contract:
            return Response({"detail": "Aucun contrat disponible pour le test."}, status=400)

        jours_restants = (contract.date_fin - timezone.localdate()).days
        mail_log = _envoyer_alerte(
            regle, contract, jours_restants, marquer_alerte=False, test_email=test_email or None
        )
        return Response(MailLogSerializer(mail_log).data, status=200)


class RegleApercuView(APIView):
    """US-E3-01/E3-03: employees concerned by this rule right now, plus the
    rendered prompt for the first match — without sending anything."""

    def get(self, request, pk):
        regle = get_object_or_404(_regle_visible_qs(request.user), pk=pk)
        return Response(apercu_regle(regle))


class RegleHistoriqueView(ListAPIView):
    """US-E3-01: history of this rule's past triggers."""

    serializer_class = AlerteEnvoyeeSerializer

    def get_queryset(self):
        regle = get_object_or_404(_regle_visible_qs(self.request.user), pk=self.kwargs["pk"])
        return AlerteEnvoyee.objects.filter(regle=regle).select_related("contract__employee")


class AutomatisationConfigView(APIView):
    """US-E3-03: global Ollama prompt + US-E3-02: daily-report time, both configurable."""

    permission_classes = [IsDRH]

    def get(self, request):
        return Response(AutomatisationConfigSerializer(AutomatisationConfig.get_solo()).data)

    def put(self, request):
        config = AutomatisationConfig.get_solo()
        serializer = AutomatisationConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class TacheSurveillanceListCreateView(ListCreateAPIView):
    serializer_class = TacheSurveillanceSerializer
    parser_classes = [MultiPartParser]

    def get_queryset(self):
        return _tache_visible_qs(self.request.user)

    def perform_create(self, serializer):
        serializer.save(cree_par=self.request.user)


class TacheSurveillanceDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = TacheSurveillanceSerializer
    parser_classes = [MultiPartParser]

    def get_queryset(self):
        return _tache_visible_qs(self.request.user)

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [IsDRH()]
        return [IsAuthenticated()]


class TacheSurveillanceRunView(APIView):
    """Execute a task right now, ignoring its schedule, and record it."""

    def post(self, request, pk):
        tache = get_object_or_404(_tache_visible_qs(request.user), pk=pk)
        execution = _executer_tache(tache, marquer_execution=True)
        return Response(ExecutionSurveillanceSerializer(execution).data, status=200)


class TacheSurveillanceTestView(APIView):
    """Execute a task right now without affecting its schedule."""

    def post(self, request, pk):
        tache = get_object_or_404(_tache_visible_qs(request.user), pk=pk)
        execution = _executer_tache(tache, marquer_execution=False)
        return Response(ExecutionSurveillanceSerializer(execution).data, status=200)


class TacheSurveillanceHistoriqueView(ListAPIView):
    serializer_class = ExecutionSurveillanceSerializer

    def get_queryset(self):
        qs = ExecutionSurveillance.objects.filter(tache__in=_tache_visible_qs(self.request.user))
        tache_id = self.request.query_params.get("tache")
        if tache_id:
            qs = qs.filter(tache_id=tache_id)
        return qs
