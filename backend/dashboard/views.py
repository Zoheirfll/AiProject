from datetime import timedelta

import requests
from django.conf import settings
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from agents.ollama_client import _client as ollama_client
from automatisations.models import RegleAutomatisation, TacheSurveillance
from core.models import ExcelImport, MailLog
from employees.models import Contract


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok", "app": "dashboard"})


def _ollama_connecte():
    try:
        ollama_client().list()
        return True
    except Exception:  # noqa: BLE001
        return False


def _n8n_connecte():
    try:
        response = requests.get(settings.N8N_URL, timeout=2)
        return response.status_code < 500
    except Exception:  # noqa: BLE001
        return False


class KpisView(APIView):
    def get(self, request):
        now = timezone.localtime()
        today = now.date()
        semaine_debut = today - timedelta(days=today.weekday())
        mois_debut = today.replace(day=1)
        horizon_30j = today + timedelta(days=30)

        mails_sent = MailLog.objects.filter(status=MailLog.Status.SENT)

        return Response(
            {
                "mails_envoyes_aujourdhui": mails_sent.filter(sent_at__date=today).count(),
                "mails_envoyes_semaine": mails_sent.filter(sent_at__date__gte=semaine_debut).count(),
                "mails_envoyes_mois": mails_sent.filter(sent_at__date__gte=mois_debut).count(),
                "regles_actives": RegleAutomatisation.objects.filter(actif=True).count(),
                "contrats_expirant_30j": Contract.objects.filter(
                    date_fin__isnull=False, date_fin__range=(today, horizon_30j)
                ).count(),
                "ollama_connecte": _ollama_connecte(),
                "n8n_connecte": _n8n_connecte(),
            }
        )


class MailsEvolutionView(APIView):
    """Daily count of sent mails over the last N days (default 30) — for a line chart."""

    def get(self, request):
        jours = int(request.query_params.get("jours", 30))
        today = timezone.localdate()
        debut = today - timedelta(days=jours - 1)

        counts = {}
        for mail in MailLog.objects.filter(
            status=MailLog.Status.SENT, sent_at__date__gte=debut
        ):
            jour = mail.sent_at.astimezone(timezone.get_current_timezone()).date()
            counts[jour] = counts.get(jour, 0) + 1

        serie = [
            {"date": (debut + timedelta(days=i)).isoformat(), "envois": counts.get(debut + timedelta(days=i), 0)}
            for i in range(jours)
        ]
        return Response(serie)


class AutomatisationsTypesView(APIView):
    """Breakdown of sent mails by originating mechanism — for a pie chart."""

    def get(self, request):
        mails = MailLog.objects.filter(status=MailLog.Status.SENT)
        alertes_contrat = mails.filter(regle__isnull=False).count()
        surveillance = mails.filter(regle__isnull=True, sujet_demande__startswith="Surveillance:").count()
        rapport = mails.filter(regle__isnull=True, sujet_demande="Rapport quotidien RH").count()
        manuel = mails.count() - alertes_contrat - surveillance - rapport

        return Response(
            [
                {"type": "Alertes contrats", "valeur": alertes_contrat},
                {"type": "Surveillance documents", "valeur": surveillance},
                {"type": "Rapport quotidien", "valeur": rapport},
                {"type": "Manuel", "valeur": max(manuel, 0)},
            ]
        )


class ContratsParMoisView(APIView):
    """Count of contracts by expiration month over the next 12 months — for a bar chart."""

    def get(self, request):
        today = timezone.localdate()
        mois_labels = []
        mois_cles = []
        annee, mois = today.year, today.month
        for _ in range(12):
            mois_labels.append(f"{mois:02d}/{annee}")
            mois_cles.append((annee, mois))
            mois += 1
            if mois > 12:
                mois = 1
                annee += 1

        contrats = Contract.objects.filter(date_fin__isnull=False, date_fin__gte=today.replace(day=1))
        compteur = {cle: 0 for cle in mois_cles}
        for contrat in contrats:
            cle = (contrat.date_fin.year, contrat.date_fin.month)
            if cle in compteur:
                compteur[cle] += 1

        return Response(
            [
                {"mois": label, "contrats": compteur[cle]}
                for label, cle in zip(mois_labels, mois_cles)
            ]
        )


class ActiviteRecenteView(APIView):
    """Unified recent-activity feed: mails sent, imports, rule triggers — for the dashboard feed."""

    def get(self, request):
        limite = int(request.query_params.get("limite", 20))

        evenements = []

        for mail in MailLog.objects.filter(status=MailLog.Status.SENT).order_by("-sent_at")[:limite]:
            evenements.append(
                {
                    "type": "mail",
                    "label": f"Mail envoyé : {mail.subject or mail.sujet_demande}",
                    "timestamp": mail.sent_at,
                    "lien": "/mails/historique",
                }
            )

        for imp in ExcelImport.objects.order_by("-created_at")[:limite]:
            evenements.append(
                {
                    "type": "import",
                    "label": f"Import Excel : {imp.nom_fichier_origine or imp.id} ({imp.lignes_importees} ligne(s))",
                    "timestamp": imp.created_at,
                    "lien": "/imports",
                }
            )

        for tache in TacheSurveillance.objects.exclude(derniere_execution__isnull=True).order_by(
            "-derniere_execution"
        )[:limite]:
            evenements.append(
                {
                    "type": "surveillance",
                    "label": f"Surveillance exécutée : {tache.nom}",
                    "timestamp": tache.derniere_execution,
                    "lien": "/surveillance",
                }
            )

        from automatisations.models import AlerteEnvoyee

        for alerte in AlerteEnvoyee.objects.select_related("regle", "contract__employee").order_by(
            "-date_envoi"
        )[:limite]:
            evenements.append(
                {
                    "type": "alerte",
                    "label": f"Alerte contrat envoyée : {alerte.regle.nom} — {alerte.contract.employee}",
                    "timestamp": alerte.date_envoi,
                    "lien": "/automatisations",
                }
            )

        evenements = [e for e in evenements if e["timestamp"] is not None]
        evenements.sort(key=lambda e: e["timestamp"], reverse=True)
        return Response(evenements[:limite])
