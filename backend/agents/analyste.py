"""Analyste agent (US-E6-01): runs after every Excel import, decides which
alerts matter, drafts the explanation via Ollama, and sends it if warranted.
"""
from datetime import timedelta

from django.utils import timezone

from .models import AgentAnalyse, AgentConfig
from .ollama_client import OllamaGenerationError, analyser_document


def _resoudre_destinataires(entries):
    from employees.models import Employee

    resolved = set()
    for entry in entries:
        if entry == "tous":
            resolved.update(
                Employee.objects.filter(actif=True).exclude(email="").values_list("email", flat=True)
            )
        elif entry.startswith("departement:"):
            departement = entry.split(":", 1)[1]
            resolved.update(
                Employee.objects.filter(departement__iexact=departement, actif=True)
                .exclude(email="")
                .values_list("email", flat=True)
            )
        elif entry:
            resolved.add(entry)
    return sorted(resolved)


def _collecter_constats(excel_import):
    from employees.models import Contract, Employee

    today = timezone.localdate()

    nouveaux = Employee.objects.filter(date_embauche__gte=today - timedelta(days=7))
    critiques = (
        Contract.objects.filter(date_fin__isnull=False, date_fin__range=(today, today + timedelta(days=30)))
        .select_related("employee")
    )
    anomalies = excel_import.erreurs if excel_import and excel_import.erreurs else []

    lignes = []
    decisions = []

    if nouveaux.exists():
        noms = ", ".join(f"{e.prenom} {e.nom}" for e in nouveaux[:20])
        lignes.append(f"Nouveaux arrivants (embauchés dans les 7 derniers jours) : {noms}")
        decisions.append(
            {"type": "nouveaux_arrivants", "description": f"{nouveaux.count()} nouvel(le)aux arrivant(e)s détecté(s)."}
        )

    if critiques.exists():
        noms = ", ".join(f"{c.employee.prenom} {c.employee.nom} ({c.date_fin})" for c in critiques[:20])
        lignes.append(f"Contrats critiques expirant sous 30 jours : {noms}")
        decisions.append(
            {"type": "contrats_critiques", "description": f"{critiques.count()} contrat(s) critique(s) détecté(s)."}
        )

    if anomalies:
        lignes.append(f"{len(anomalies)} anomalie(s) détectée(s) lors de l'import.")
        decisions.append(
            {"type": "anomalies", "description": f"{len(anomalies)} anomalie(s) dans les données importées."}
        )

    contenu = "\n".join(lignes) or "Aucun élément notable détecté dans cet import."
    return contenu, decisions


ANALYSTE_PROMPT = (
    "Tu es un agent RH qui vient d'analyser un import Excel de données employés. "
    "Explique en français, de façon claire et concise, ce que tu as trouvé et "
    "pourquoi c'est important pour l'équipe RH."
)


def analyser_import(excel_import=None):
    """Run the analyste agent for one import (or None for an ad-hoc snapshot
    analysis). Creates and returns an AgentAnalyse row; sends an alert email
    if the model decides it's warranted and recipients are configured."""
    from core.models import MailLog
    from core.services import send_mail_log

    config = AgentConfig.get_solo()
    contenu, decisions = _collecter_constats(excel_import)

    try:
        analyse = analyser_document(
            ANALYSTE_PROMPT, contenu, forcer_envoi=False, model=config.modele("analyste")
        )
    except OllamaGenerationError as exc:
        analyse = {"envoyer": False, "subject": "", "body": f"Erreur d'analyse Ollama : {exc}"}

    alertes_envoyees = 0
    if analyse["envoyer"] and config.analyste_destinataires:
        destinataires = _resoudre_destinataires(config.analyste_destinataires)
        if destinataires:
            mail_log = MailLog.objects.create(
                sujet_demande="Analyse agent RH",
                subject=analyse["subject"] or "Analyse RH — points d'attention",
                body=analyse["body"],
            )
            try:
                send_mail_log(mail_log, destinataires)
                mail_log.status = MailLog.Status.SENT
                mail_log.sent_at = timezone.now()
                alertes_envoyees = 1
            except Exception as exc:  # noqa: BLE001
                mail_log.status = MailLog.Status.FAILED
                mail_log.erreur = str(exc)
            mail_log.save()

    return AgentAnalyse.objects.create(
        excel_import=excel_import,
        resume=analyse["body"] or contenu,
        decisions=decisions,
        alertes_envoyees=alertes_envoyees,
    )
