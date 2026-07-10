from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from core.serializers import MailLogSerializer
from employees.models import Contract

from .models import RegleAutomatisation
from .serializers import RegleAutomatisationSerializer
from .services import _envoyer_alerte, evaluer_regles


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
