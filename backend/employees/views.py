from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Employee
from .serializers import EmployeeSerializer


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok", "app": "employees"})


class EmployeePagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 200


ORDERABLE_FIELDS = {
    "matricule", "nom", "prenom", "departement", "poste", "categorie", "date_embauche",
}


class EmployeeListView(ListAPIView):
    serializer_class = EmployeeSerializer
    pagination_class = EmployeePagination

    def get_queryset(self):
        qs = Employee.objects.all()
        departement = self.request.query_params.get("departement")
        categorie = self.request.query_params.get("categorie")
        type_contrat = self.request.query_params.get("type_contrat")
        actif = self.request.query_params.get("actif")
        search = self.request.query_params.get("search")
        ordering = self.request.query_params.get("ordering")

        if departement:
            qs = qs.filter(departement__iexact=departement)
        if categorie:
            qs = qs.filter(categorie__iexact=categorie)
        if type_contrat:
            qs = qs.filter(contracts__type=type_contrat.upper()).distinct()
        if actif is not None:
            qs = qs.filter(actif=actif.lower() in ("1", "true", "yes"))
        if search:
            qs = qs.filter(nom__icontains=search) | qs.filter(prenom__icontains=search) | qs.filter(matricule__icontains=search)

        if ordering:
            field = ordering.lstrip("-")
            if field in ORDERABLE_FIELDS:
                qs = qs.order_by(ordering)

        return qs
