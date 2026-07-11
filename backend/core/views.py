import logging
from types import SimpleNamespace

from django.conf import settings
from django.core.mail import get_connection
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.generics import ListAPIView
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsDRH
from agents.ollama_client import OllamaGenerationError, generate_mail_content
from employees.models import Employee

from .models import IMPORT_MAPPING_FIELDS, ExcelImport, ImportConfig, MailLog, TechnicalLog
from .serializers import ExcelImportSerializer, MailLogSerializer, TechnicalLogSerializer
from .services import (
    build_import_template,
    fichier_trop_volumineux,
    parse_employee_excel,
    parse_mail_masse_excel,
    send_mail_log,
)

logger = logging.getLogger("grh_auto.core")


class ImportModeleView(APIView):
    """Downloadable Excel template — recognized columns + two free-form
    example columns, so it's obvious the sheet isn't limited to a fixed
    schema (see core.services.build_import_template)."""

    def get(self, request):
        buffer = build_import_template()
        response = HttpResponse(
            buffer.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="modele_import_employes.xlsx"'
        return response


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok", "app": "core"})


class ImportUploadView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        uploaded_file = request.FILES.get("fichier")
        if not uploaded_file:
            return Response({"detail": "Aucun fichier fourni."}, status=400)
        if fichier_trop_volumineux(uploaded_file):
            return Response({"detail": "Fichier trop volumineux (max 10 Mo)."}, status=400)

        excel_import = ExcelImport.objects.create(
            fichier=uploaded_file, nom_fichier_origine=uploaded_file.name, cree_par=request.user,
        )
        mapping = ImportConfig.get_solo().mapping or None
        lignes = []

        try:
            total, imported, errors, lignes = parse_employee_excel(excel_import.fichier, mapping)
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

        if excel_import.status == ExcelImport.Status.SUCCESS:
            from agents.analyste import analyser_import

            try:
                analyser_import(excel_import, lignes=lignes, cree_par=request.user)
            except Exception:  # noqa: BLE001
                pass  # the analyste agent is best-effort; never fail the upload because of it

        if excel_import.status == ExcelImport.Status.SUCCESS:
            logger.info("Import '%s' terminé (%s lignes importées)", excel_import.nom_fichier_origine, excel_import.lignes_importees)
        else:
            logger.warning("Import '%s' en échec: %s", excel_import.nom_fichier_origine, excel_import.erreurs)

        from integrations.notifications import notify

        notify(
            {
                "type": "import",
                "id": excel_import.id,
                "fichier": excel_import.nom_fichier_origine,
                "status": excel_import.status,
                "lignes_importees": excel_import.lignes_importees,
            }
        )

        return Response(ExcelImportSerializer(excel_import).data, status=201)


def _import_visible_qs(user):
    """A Chargé RH only sees imports they created; ownerless imports (e.g.
    folder-watch, which has no request.user) stay visible to everyone;
    DRH sees everything."""
    from django.db.models import Q

    qs = ExcelImport.objects.all()
    if user.is_drh:
        return qs
    return qs.filter(Q(cree_par=user) | Q(cree_par__isnull=True))


class ImportHistoryView(ListAPIView):
    serializer_class = ExcelImportSerializer

    def get_queryset(self):
        return _import_visible_qs(self.request.user)


class ImportDeleteView(APIView):
    permission_classes = [IsDRH]

    def delete(self, request, pk):
        try:
            excel_import = ExcelImport.objects.get(pk=pk)
        except ExcelImport.DoesNotExist:
            return Response({"detail": "Import introuvable."}, status=404)
        excel_import.delete()
        return Response(status=204)


class ImportMappingView(APIView):
    """Get/save the reusable Excel column mapping and the watched-folder path."""

    permission_classes = [IsDRH]

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
    sujet_demande, prompt_override=None, employee=None, destinataire_nom="", destinataire_email="",
    format="TEXTE",
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
        format=format,
    )

    try:
        result = generate_mail_content(contact, sujet_demande, prompt_override, format=format)
        mail_log.subject = result["subject"]
        mail_log.body = result["body"]
        mail_log.status = MailLog.Status.DRAFT
    except OllamaGenerationError as exc:
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = str(exc)
        logger.error("Erreur Ollama lors de la génération d'un brouillon: %s", exc)

        from integrations.notifications import notify

        notify({"type": "erreur_ollama", "contexte": "génération de mail", "detail": str(exc)})
    mail_log.save()

    return mail_log


class MailApercuView(APIView):
    def post(self, request):
        employee_id = request.data.get("employee_id")
        destinataire_nom = (request.data.get("destinataire_nom") or "").strip()
        destinataire_email = (request.data.get("destinataire_email") or "").strip()
        sujet_demande = request.data.get("sujet_demande")
        prompt_override = request.data.get("prompt_override")
        format = (request.data.get("format") or "TEXTE").upper()
        if format not in ("TEXTE", "HTML"):
            format = "TEXTE"

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
            format=format,
        )

        return Response(MailLogSerializer(mail_log).data, status=201)


class MailApercuMasseView(APIView):
    """Bulk draft generation from an uploaded Excel file (columns: email, nom, sujet)."""

    parser_classes = [MultiPartParser]

    def post(self, request):
        uploaded_file = request.FILES.get("fichier")
        if not uploaded_file:
            return Response({"detail": "Aucun fichier fourni."}, status=400)
        if fichier_trop_volumineux(uploaded_file):
            return Response({"detail": "Fichier trop volumineux (max 10 Mo)."}, status=400)

        sujet_defaut = (request.data.get("sujet_demande") or "").strip()
        prompt_override = request.data.get("prompt_override")
        format = (request.data.get("format") or "TEXTE").upper()
        if format not in ("TEXTE", "HTML"):
            format = "TEXTE"

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
                    format=format,
                )
            drafts.append(mail_log)

        return Response(
            {
                "drafts": MailLogSerializer(drafts, many=True).data,
                "erreurs": parse_errors,
            },
            status=201,
        )


def _envoyer_mail_log(mail_log, subject=None, body=None, format=None):
    if subject:
        mail_log.subject = subject
    if body:
        mail_log.body = body
    if format in ("TEXTE", "HTML"):
        mail_log.format = format

    destinataire = mail_log.email_destinataire
    if not destinataire:
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = "Aucune adresse email de destinataire."
        mail_log.save()
        return mail_log

    try:
        send_mail_log(mail_log, [destinataire], cc=mail_log.cc, bcc=mail_log.bcc)
        mail_log.status = MailLog.Status.SENT
        mail_log.sent_at = timezone.now()
    except Exception as exc:  # noqa: BLE001
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = str(exc)
    mail_log.save()

    from integrations.notifications import notify

    if mail_log.status == MailLog.Status.SENT:
        logger.info("Mail #%s envoyé (%s)", mail_log.id, mail_log.subject)
        notify({"type": "mail", "id": mail_log.id, "subject": mail_log.subject})
    else:
        logger.error("Échec d'envoi du mail #%s: %s", mail_log.id, mail_log.erreur)
        notify({"type": "mail_echec", "id": mail_log.id, "subject": mail_log.subject, "erreur": mail_log.erreur})

    return mail_log


class MailEnvoyerView(APIView):
    def post(self, request):
        mail_log_id = request.data.get("mail_log_id")
        subject = request.data.get("subject")
        body = request.data.get("body")
        format = request.data.get("format")

        if not mail_log_id:
            return Response({"detail": "mail_log_id est requis."}, status=400)

        try:
            mail_log = MailLog.objects.get(pk=mail_log_id)
        except MailLog.DoesNotExist:
            return Response({"detail": "Mail introuvable."}, status=404)

        if not mail_log.email_destinataire:
            return Response({"detail": "Aucune adresse email de destinataire."}, status=400)

        mail_log = _envoyer_mail_log(mail_log, subject, body, format)

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
        return _mail_historique_qs(self.request)


class TechnicalLogView(ListAPIView):
    """US-E8-02: logs techniques consultables sur /logs (DRH uniquement)."""

    permission_classes = [IsDRH]
    serializer_class = TechnicalLogSerializer

    def get_queryset(self):
        qs = TechnicalLog.objects.all()
        level = self.request.query_params.get("level")
        logger_name = self.request.query_params.get("logger")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if level:
            qs = qs.filter(level=level.upper())
        if logger_name:
            qs = qs.filter(logger_name__icontains=logger_name)
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        return qs


def _mail_historique_qs(request):
    qs = MailLog.objects.all()
    statut = request.query_params.get("statut")
    employee_id = request.query_params.get("employee")
    date_str = request.query_params.get("date")

    if statut:
        qs = qs.filter(status=statut.upper())
    if employee_id:
        qs = qs.filter(employee_id=employee_id)
    if date_str:
        qs = qs.filter(created_at__date=date_str)

    return qs


class MailHistoriqueExportView(APIView):
    """US-E8-03: export de l'historique des mails filtré, en PDF ou Excel."""

    def get(self, request):
        export_format = (request.query_params.get("export_format") or "excel").lower()
        rows = list(_mail_historique_qs(request))
        filename_date = timezone.now().strftime("%Y-%m-%d")

        if export_format == "pdf":
            from .services import build_mail_historique_pdf

            buffer = build_mail_historique_pdf(rows)
            response = HttpResponse(buffer.read(), content_type="application/pdf")
            response["Content-Disposition"] = f'attachment; filename="historique_mails_{filename_date}.pdf"'
            return response

        from .services import build_mail_historique_excel

        buffer = build_mail_historique_excel(rows)
        response = HttpResponse(
            buffer.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="historique_mails_{filename_date}.xlsx"'
        return response


class SmtpTestView(APIView):
    permission_classes = [IsDRH]

    def post(self, request):
        import smtplib

        connection = get_connection(fail_silently=False)
        try:
            connection.open()
            connection.close()
        except smtplib.SMTPAuthenticationError as exc:
            return Response(
                {
                    "status": "erreur",
                    "detail": (
                        "Authentification SMTP refusée. Si EMAIL_HOST_USER utilise un compte Gmail "
                        "avec la double authentification (2FA) activée, EMAIL_HOST_PASSWORD doit être "
                        "un mot de passe d'application généré sur "
                        "https://myaccount.google.com/apppasswords, pas le mot de passe du compte."
                    ),
                    "erreur_brute": str(exc),
                },
                status=400,
            )
        except Exception as exc:  # noqa: BLE001
            return Response({"status": "erreur", "detail": str(exc)}, status=400)

        return Response({"status": "ok"})


class ConfigView(APIView):
    permission_classes = [IsDRH]

    def get(self, request):
        return Response(
            {
                "ollama_base_url": settings.OLLAMA_BASE_URL,
                "ollama_model": settings.OLLAMA_MODEL,
                "email_host": settings.EMAIL_HOST,
                "email_host_user": settings.EMAIL_HOST_USER,
            }
        )
