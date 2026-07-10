from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from core.serializers import MailLogSerializer
from employees.models import Contract

from .models import ExecutionSurveillance, RegleAutomatisation, TacheSurveillance
from .serializers import (
    ExecutionSurveillanceSerializer,
    RegleAutomatisationSerializer,
    TacheSurveillanceSerializer,
)
from .services import _envoyer_alerte, _executer_tache, evaluer_regles


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok", "app": "automatisations"})


class RegleListCreateView(ListCreateAPIView):
    queryset = RegleAutomatisation.objects.all()
    serializer_class = RegleAutomatisationSerializer


class RegleDetailView(RetrieveUpdateDestroyAPIView):
    queryset = RegleAutomatisation.objects.all()
    serializer_class = RegleAutomatisationSerializer


class RegleRunView(APIView):
    def post(self, request, pk):
        get_object_or_404(RegleAutomatisation, pk=pk)
        resultats = evaluer_regles(regle_id=pk)
        return Response(MailLogSerializer(resultats, many=True).data, status=200)


class RegleTestView(APIView):
    def post(self, request, pk):
        regle = get_object_or_404(RegleAutomatisation, pk=pk)
        contract = (
            Contract.objects.filter(date_fin__isnull=False)
            .select_related("employee")
            .first()
        )
        if not contract:
            return Response({"detail": "Aucun contrat disponible pour le test."}, status=400)

        jours_restants = (contract.date_fin - timezone.localdate()).days
        mail_log = _envoyer_alerte(regle, contract, jours_restants, marquer_alerte=False)
        return Response(MailLogSerializer(mail_log).data, status=200)


class TacheSurveillanceListCreateView(ListCreateAPIView):
    queryset = TacheSurveillance.objects.all()
    serializer_class = TacheSurveillanceSerializer
    parser_classes = [MultiPartParser]


class TacheSurveillanceDetailView(RetrieveUpdateDestroyAPIView):
    queryset = TacheSurveillance.objects.all()
    serializer_class = TacheSurveillanceSerializer
    parser_classes = [MultiPartParser]


class TacheSurveillanceRunView(APIView):
    """Execute a task right now, ignoring its schedule, and record it."""

    def post(self, request, pk):
        tache = get_object_or_404(TacheSurveillance, pk=pk)
        execution = _executer_tache(tache, marquer_execution=True)
        return Response(ExecutionSurveillanceSerializer(execution).data, status=200)


class TacheSurveillanceTestView(APIView):
    """Execute a task right now without affecting its schedule."""

    def post(self, request, pk):
        tache = get_object_or_404(TacheSurveillance, pk=pk)
        execution = _executer_tache(tache, marquer_execution=False)
        return Response(ExecutionSurveillanceSerializer(execution).data, status=200)


class TacheSurveillanceHistoriqueView(ListAPIView):
    serializer_class = ExecutionSurveillanceSerializer

    def get_queryset(self):
        qs = ExecutionSurveillance.objects.all()
        tache_id = self.request.query_params.get("tache")
        if tache_id:
            qs = qs.filter(tache_id=tache_id)
        return qs
