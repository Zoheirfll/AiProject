from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Employee
from .serializers import EmployeeSerializer


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok", "app": "employees"})


class EmployeeListView(ListAPIView):
    serializer_class = EmployeeSerializer

    def get_queryset(self):
        qs = Employee.objects.all()
        departement = self.request.query_params.get("departement")
        actif = self.request.query_params.get("actif")
        search = self.request.query_params.get("search")

        if departement:
            qs = qs.filter(departement__iexact=departement)
        if actif is not None:
            qs = qs.filter(actif=actif.lower() in ("1", "true", "yes"))
        if search:
            qs = qs.filter(nom__icontains=search) | qs.filter(prenom__icontains=search) | qs.filter(matricule__icontains=search)

        return qs
