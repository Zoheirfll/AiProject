from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import RegleAutomatisation
from .serializers import RegleAutomatisationSerializer


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok", "app": "automatisations"})


class RegleListCreateView(ListCreateAPIView):
    queryset = RegleAutomatisation.objects.all()
    serializer_class = RegleAutomatisationSerializer


class RegleDetailView(RetrieveUpdateDestroyAPIView):
    queryset = RegleAutomatisation.objects.all()
    serializer_class = RegleAutomatisationSerializer
