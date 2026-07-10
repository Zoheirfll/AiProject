from types import SimpleNamespace

from django.conf import settings
from django.core.mail import EmailMessage, get_connection
from django.utils import timezone
from rest_framework.generics import ListAPIView
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from agents.ollama_client import OllamaGenerationError, generate_mail_content
from employees.models import Employee

from .models import IMPORT_MAPPING_FIELDS, ExcelImport, ImportConfig, MailLog
from .serializers import ExcelImportSerializer, MailLogSerializer
from .services import parse_employee_excel, parse_mail_masse_excel


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok", "app": "core"})


class ImportUploadView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        uploaded_file = request.FILES.get("fichier")
        if not uploaded_file:
            return Response({"detail": "Aucun fichier fourni."}, status=400)

        excel_import = ExcelImport.objects.create(
            fichier=uploaded_file, nom_fichier_origine=uploaded_file.name
        )
        mapping = ImportConfig.get_solo().mapping or None

        try:
            total, imported, errors = parse_employee_excel(excel_import.fichier, mapping)
            excel_import.lignes_total = total
            excel_import.lignes_importees = imported
            excel_import.lignes_erreurs = len(errors)
            excel_import.erreurs = errors
            excel_import.status = (
                ExcelImport.Status.SUCCESS
                if imported > 0 or (total == 0 and not errors)
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


class ImportDeleteView(APIView):
    def delete(self, request, pk):
        try:
            excel_import = ExcelImport.objects.get(pk=pk)
        except ExcelImport.DoesNotExist:
            return Response({"detail": "Import introuvable."}, status=404)
        excel_import.delete()
        return Response(status=204)


class ImportMappingView(APIView):
    """Get/save the reusable Excel column mapping and the watched-folder path."""

    def get(self, request):
        config = ImportConfig.get_solo()
        return Response(
            {
                "champs": IMPORT_MAPPING_FIELDS,
                "mapping": config.mapping,
                "dossier_surveille": config.dossier_surveille,
            }
        )

    def put(self, request):
        config = ImportConfig.get_solo()
        mapping = request.data.get("mapping")
        dossier_surveille = request.data.get("dossier_surveille")

        if mapping is not None:
            if not isinstance(mapping, dict):
                return Response({"detail": "mapping doit être un objet."}, status=400)
            config.mapping = {
                field: str(col).strip().lower()
                for field, col in mapping.items()
                if field in IMPORT_MAPPING_FIELDS and col
            }
        if dossier_surveille is not None:
            config.dossier_surveille = str(dossier_surveille).strip()

        config.save()
        return Response(
            {
                "champs": IMPORT_MAPPING_FIELDS,
                "mapping": config.mapping,
                "dossier_surveille": config.dossier_surveille,
            }
        )


def _generer_brouillon(
    sujet_demande, prompt_override=None, employee=None, destinataire_nom="", destinataire_email=""
):
    """Create a MailLog and fill it via Ollama. Shared by single and bulk drafting."""
    if employee is not None:
        contact = employee
    else:
        contact = SimpleNamespace(
            prenom=destinataire_nom or destinataire_email,
            nom="",
            poste=None,
            departement=None,
        )

    mail_log = MailLog.objects.create(
        employee=employee,
        destinataire_nom=destinataire_nom,
        destinataire_email=destinataire_email,
        sujet_demande=sujet_demande,
    )

    try:
        result = generate_mail_content(contact, sujet_demande, prompt_override)
        mail_log.subject = result["subject"]
        mail_log.body = result["body"]
        mail_log.status = MailLog.Status.DRAFT
    except OllamaGenerationError as exc:
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = str(exc)
    mail_log.save()

    return mail_log


class MailApercuView(APIView):
    def post(self, request):
        employee_id = request.data.get("employee_id")
        destinataire_nom = (request.data.get("destinataire_nom") or "").strip()
        destinataire_email = (request.data.get("destinataire_email") or "").strip()
        sujet_demande = request.data.get("sujet_demande")
        prompt_override = request.data.get("prompt_override")

        if not sujet_demande:
            return Response({"detail": "sujet_demande est requis."}, status=400)

        if not employee_id and not destinataire_email:
            return Response(
                {"detail": "employee_id ou destinataire_email est requis."}, status=400
            )

        employee = None
        if employee_id:
            try:
                employee = Employee.objects.get(pk=employee_id)
            except Employee.DoesNotExist:
                return Response({"detail": "Employé introuvable."}, status=404)

        mail_log = _generer_brouillon(
            sujet_demande,
            prompt_override,
            employee=employee,
            destinataire_nom=destinataire_nom,
            destinataire_email=destinataire_email,
        )

        return Response(MailLogSerializer(mail_log).data, status=201)


class MailApercuMasseView(APIView):
    """Bulk draft generation from an uploaded Excel file (columns: email, nom, sujet)."""

    parser_classes = [MultiPartParser]

    def post(self, request):
        uploaded_file = request.FILES.get("fichier")
        if not uploaded_file:
            return Response({"detail": "Aucun fichier fourni."}, status=400)

        sujet_defaut = (request.data.get("sujet_demande") or "").strip()
        prompt_override = request.data.get("prompt_override")

        try:
            rows, parse_errors = parse_mail_masse_excel(uploaded_file)
        except Exception as exc:  # noqa: BLE001
            return Response({"detail": f"Fichier illisible: {exc}"}, status=400)

        if parse_errors and not rows:
            return Response({"detail": parse_errors[0]["message"], "erreurs": parse_errors}, status=400)

        drafts = []
        for row in rows:
            sujet_demande = row["sujet"] or sujet_defaut
            if not sujet_demande:
                mail_log = MailLog.objects.create(
                    destinataire_nom=row["nom"],
                    destinataire_email=row["email"],
                    sujet_demande="",
                    status=MailLog.Status.FAILED,
                    erreur="Aucun sujet fourni (ni colonne 'sujet' ni sujet par défaut).",
                )
            else:
                mail_log = _generer_brouillon(
                    sujet_demande,
                    prompt_override,
                    destinataire_nom=row["nom"],
                    destinataire_email=row["email"],
                )
            drafts.append(mail_log)

        return Response(
            {
                "drafts": MailLogSerializer(drafts, many=True).data,
                "erreurs": parse_errors,
            },
            status=201,
        )


def _envoyer_mail_log(mail_log, subject=None, body=None):
    if subject:
        mail_log.subject = subject
    if body:
        mail_log.body = body

    destinataire = mail_log.email_destinataire
    if not destinataire:
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = "Aucune adresse email de destinataire."
        mail_log.save()
        return mail_log

    try:
        EmailMessage(
            subject=mail_log.subject,
            body=mail_log.body,
            to=[destinataire],
            cc=mail_log.cc or None,
            bcc=mail_log.bcc or None,
        ).send(fail_silently=False)
        mail_log.status = MailLog.Status.SENT
        mail_log.sent_at = timezone.now()
    except Exception as exc:  # noqa: BLE001
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = str(exc)
    mail_log.save()

    return mail_log


class MailEnvoyerView(APIView):
    def post(self, request):
        mail_log_id = request.data.get("mail_log_id")
        subject = request.data.get("subject")
        body = request.data.get("body")

        if not mail_log_id:
            return Response({"detail": "mail_log_id est requis."}, status=400)

        try:
            mail_log = MailLog.objects.get(pk=mail_log_id)
        except MailLog.DoesNotExist:
            return Response({"detail": "Mail introuvable."}, status=404)

        if not mail_log.email_destinataire:
            return Response({"detail": "Aucune adresse email de destinataire."}, status=400)

        mail_log = _envoyer_mail_log(mail_log, subject, body)

        return Response(MailLogSerializer(mail_log).data, status=200)


class MailEnvoyerMasseView(APIView):
    """Send a batch of previously-drafted MailLogs (e.g. from /mails/apercu-masse/)."""

    def post(self, request):
        items = request.data.get("mails")
        if not isinstance(items, list) or not items:
            return Response({"detail": "mails (liste) est requis."}, status=400)

        results = []
        for item in items:
            mail_log_id = item.get("mail_log_id")
            try:
                mail_log = MailLog.objects.get(pk=mail_log_id)
            except (MailLog.DoesNotExist, TypeError, ValueError):
                continue
            results.append(_envoyer_mail_log(mail_log, item.get("subject"), item.get("body")))

        return Response(MailLogSerializer(results, many=True).data, status=200)


class MailHistoriqueView(ListAPIView):
    serializer_class = MailLogSerializer

    def get_queryset(self):
        qs = MailLog.objects.all()
        statut = self.request.query_params.get("statut")
        employee_id = self.request.query_params.get("employee")
        date_str = self.request.query_params.get("date")

        if statut:
            qs = qs.filter(status=statut.upper())
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        if date_str:
            qs = qs.filter(created_at__date=date_str)

        return qs


class SmtpTestView(APIView):
    def post(self, request):
        connection = get_connection(fail_silently=False)
        try:
            connection.open()
            connection.close()
        except Exception as exc:  # noqa: BLE001
            return Response({"status": "erreur", "detail": str(exc)}, status=400)

        return Response({"status": "ok"})


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
