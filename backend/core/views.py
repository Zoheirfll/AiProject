from django.conf import settings
from rest_framework.generics import ListAPIView
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from agents.ollama_client import OllamaGenerationError, generate_mail_content
from employees.models import Employee

from .models import ExcelImport, MailLog
from .serializers import ExcelImportSerializer, MailLogSerializer
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


class MailApercuView(APIView):
    def post(self, request):
        employee_id = request.data.get("employee_id")
        sujet_demande = request.data.get("sujet_demande")
        prompt_override = request.data.get("prompt_override")

        if not employee_id or not sujet_demande:
            return Response(
                {"detail": "employee_id et sujet_demande sont requis."}, status=400
            )

        try:
            employee = Employee.objects.get(pk=employee_id)
        except Employee.DoesNotExist:
            return Response({"detail": "Employé introuvable."}, status=404)

        mail_log = MailLog.objects.create(employee=employee, sujet_demande=sujet_demande)

        try:
            result = generate_mail_content(employee, sujet_demande, prompt_override)
            mail_log.subject = result["subject"]
            mail_log.body = result["body"]
            mail_log.status = MailLog.Status.DRAFT
        except OllamaGenerationError as exc:
            mail_log.status = MailLog.Status.FAILED
            mail_log.erreur = str(exc)
        mail_log.save()

        return Response(MailLogSerializer(mail_log).data, status=201)


class ConfigView(APIView):
    def get(self, request):
        return Response(
            {
                "ollama_base_url": settings.OLLAMA_BASE_URL,
                "ollama_model": settings.OLLAMA_MODEL,
                "email_host": settings.EMAIL_HOST,
                "email_host_user": settings.EMAIL_HOST_USER,
            }
        )
