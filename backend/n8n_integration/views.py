from datetime import timedelta

from django.utils import timezone
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import MailLog
from core.services import send_mail_log
from employees.models import Contract, Employee
from employees.serializers import EmployeeSerializer

from .models import N8nApiLog, N8nApiToken
from .permissions import HasN8nScope
from .serializers import ContratExpirantSerializer


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok", "app": "n8n_integration"})


class N8nBaseView(APIView):
    """Base for every /api/n8n/* endpoint: scoped-token auth instead of the
    session/CSRF the rest of the app uses (n8n is a machine caller, not a
    browser), and automatic call logging (US-E7-02 'logs de tous les
    appels n8n dans Django') — every request/response is recorded as an
    N8nApiLog regardless of which subclass handles it.

    Subclasses set `required_scope = N8nApiToken.Scope.XXX` so a token
    minted for one workflow can be limited to just what it needs."""

    authentication_classes = []
    permission_classes = [HasN8nScope]
    required_scope = None

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        try:
            payload = ""
            if request.method in ("POST", "PUT", "PATCH"):
                payload = str(request.data)[:500]
            N8nApiLog.objects.create(
                endpoint=request.path,
                method=request.method,
                status_code=response.status_code,
                ip_address=request.META.get("REMOTE_ADDR"),
                payload_resume=payload,
                token=getattr(request, "n8n_token", None),
            )
        except Exception:  # noqa: BLE001
            pass  # logging must never break the actual n8n call
        return response


class N8nEmployesView(N8nBaseView, ListAPIView):
    """GET /api/n8n/employes/ — active employees (optional ?departement=)."""

    required_scope = N8nApiToken.Scope.EMPLOYES_READ
    serializer_class = EmployeeSerializer

    def get_queryset(self):
        qs = Employee.objects.filter(actif=True)
        departement = self.request.query_params.get("departement")
        if departement:
            qs = qs.filter(departement__iexact=departement)
        return qs


class N8nContratsExpirantsView(N8nBaseView, ListAPIView):
    """GET /api/n8n/contrats-expirants/?jours=30 — contracts expiring within N days (default 30)."""

    required_scope = N8nApiToken.Scope.CONTRATS_READ
    serializer_class = ContratExpirantSerializer

    def get_queryset(self):
        jours = int(self.request.query_params.get("jours", 30))
        today = timezone.localdate()
        horizon = today + timedelta(days=jours)
        return (
            Contract.objects.filter(date_fin__isnull=False, date_fin__range=(today, horizon))
            .select_related("employee")
            .order_by("date_fin")
        )


class N8nEnvoyerMailView(N8nBaseView):
    """POST /api/n8n/mails/envoyer/ — generate (Ollama) and immediately send
    a mail in one call (n8n workflows don't do a two-step preview/send)."""

    required_scope = N8nApiToken.Scope.MAILS_SEND

    def post(self, request):
        from types import SimpleNamespace

        from agents.ollama_client import OllamaGenerationError, generate_mail_content

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

        employee = None
        if employee_id:
            try:
                employee = Employee.objects.get(pk=employee_id)
            except Employee.DoesNotExist:
                return Response({"detail": "Employé introuvable."}, status=404)

        destinataire = employee.email if employee else destinataire_email
        if not destinataire:
            return Response({"detail": "Aucune adresse email de destinataire."}, status=400)

        contact = employee or SimpleNamespace(
            prenom=destinataire_nom or destinataire_email, nom="", poste=None, departement=None,
        )
        mail_log = MailLog.objects.create(
            employee=employee, destinataire_nom=destinataire_nom, destinataire_email=destinataire_email,
            sujet_demande=sujet_demande, format=format,
        )

        try:
            result = generate_mail_content(contact, sujet_demande, prompt_override, format=format)
            mail_log.subject = result["subject"]
            mail_log.body = result["body"]
        except OllamaGenerationError as exc:
            mail_log.status = MailLog.Status.FAILED
            mail_log.erreur = str(exc)
            mail_log.save()
            return Response({"detail": str(exc)}, status=502)

        try:
            send_mail_log(mail_log, [destinataire])
            mail_log.status = MailLog.Status.SENT
            mail_log.sent_at = timezone.now()
        except Exception as exc:  # noqa: BLE001
            mail_log.status = MailLog.Status.FAILED
            mail_log.erreur = str(exc)
            mail_log.save()
            return Response({"detail": str(exc)}, status=502)

        mail_log.save()
        return Response({"id": mail_log.id, "status": mail_log.status, "subject": mail_log.subject}, status=201)


class N8nLogView(N8nBaseView):
    """POST /api/n8n/logs/ — lets an n8n workflow record an arbitrary event
    (e.g. 'workflow X finished, processed N contracts') beyond the
    automatic per-call logging every N8nBaseView subclass already does."""

    required_scope = N8nApiToken.Scope.LOGS_WRITE

    def post(self, request):
        message = (request.data.get("message") or "").strip()
        if not message:
            return Response({"detail": "message est requis."}, status=400)
        # Recorded via the same N8nApiLog audit trail (finalize_response
        # above), payload_resume already captures the message — nothing
        # extra to persist here beyond acknowledging receipt.
        return Response({"detail": "ok"}, status=201)
