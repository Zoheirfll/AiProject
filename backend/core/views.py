from rest_framework.generics import ListAPIView
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ExcelImport
from .serializers import ExcelImportSerializer
from .services import parse_employee_excel


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok", "app": "core"})


class ImportUploadView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        uploaded_file = request.FILES.get("fichier")
        if not uploaded_file:
            return Response({"detail": "Aucun fichier fourni."}, status=400)

        excel_import = ExcelImport.objects.create(fichier=uploaded_file)

        try:
            total, imported, errors = parse_employee_excel(excel_import.fichier)
            excel_import.lignes_total = total
            excel_import.lignes_importees = imported
            excel_import.lignes_erreurs = len(errors)
            excel_import.erreurs = errors
            excel_import.status = (
                ExcelImport.Status.SUCCESS
                if imported > 0 or total == 0
                else ExcelImport.Status.FAILED
            )
        except Exception as exc:  # noqa: BLE001
            excel_import.status = ExcelImport.Status.FAILED
            excel_import.erreurs = [{"ligne": 0, "message": str(exc)}]
        excel_import.save()

        return Response(ExcelImportSerializer(excel_import).data, status=201)


class ImportHistoryView(ListAPIView):
    queryset = ExcelImport.objects.all()
    serializer_class = ExcelImportSerializer
