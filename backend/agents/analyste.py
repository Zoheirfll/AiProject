"""Analyste agent (US-E6-01): runs after every Excel import and lets Ollama
decide, generically, what matters — HR data isn't limited to contracts
(leave, training, evaluations, disciplinary notes, anything a sheet might
contain), so this deliberately does NOT hardcode categories like "expiring
contract" or "new hire". It's the same free-form approach as the document
surveillance agent (agents.ollama_client.analyser_document), just applied
to Employee imports instead of a watched document.
"""
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


def _ligne_texte(ligne):
    return " | ".join(
        f"{k}: {v}" for k, v in ligne.items()
        if v not in (None, "", {}) and k != "donnees_supplementaires"
    ) + (
        " | " + " | ".join(f"{k}: {v}" for k, v in ligne.get("donnees_supplementaires", {}).items())
        if ligne.get("donnees_supplementaires")
        else ""
    )


def _collecter_contenu(excel_import, lignes):
    """Build a plain-text dump of whatever was actually imported — no
    assumption about subject matter — for the LLM to analyze freely."""
    anomalies = excel_import.erreurs if excel_import and excel_import.erreurs else []

    parties = []
    if lignes:
        apercu = "\n".join(_ligne_texte(ligne) for ligne in lignes[:50])
        parties.append(f"Lignes importées ({len(lignes)} au total, aperçu ci-dessous) :\n{apercu}")
    if anomalies:
        details = "; ".join(a.get("message", "") for a in anomalies[:20])
        parties.append(f"{len(anomalies)} anomalie(s) détectée(s) lors de l'import : {details}")

    return "\n\n".join(parties) or "Aucune donnée exploitable pour cet import."


ANALYSTE_PROMPT = (
    "Tu es un agent RH qui vient d'analyser un import de données Excel. Ces données "
    "peuvent porter sur n'importe quel sujet RH (contrats, congés, formations, "
    "évaluations, absences, sanctions, etc.) — ne suppose rien à l'avance sur leur "
    "contenu. Identifie ce qui te semble important ou nécessitant une action de la "
    "part de l'équipe RH, et explique-le en français, de façon claire et concise."
)


def analyser_import(excel_import=None, lignes=None, cree_par=None):
    """Run the analyste agent for one import (or None + lignes=None for an
    ad-hoc snapshot analysis). Creates and returns an AgentAnalyse row;
    sends an alert email if the model decides it's warranted and recipients
    are configured. cree_par is the triggering user, or None for background
    jobs (folder-watch imports) — ownerless rows stay visible to everyone,
    same convention as automatisations/core.ExcelImport."""
    from core.models import MailLog
    from core.services import send_mail_log

    config = AgentConfig.get_solo()
    contenu = _collecter_contenu(excel_import, lignes or [])

    try:
        analyse = analyser_document(
            ANALYSTE_PROMPT, contenu, forcer_envoi=False, model=config.modele("analyste")
        )
    except OllamaGenerationError as exc:
        analyse = {"envoyer": False, "subject": "", "body": f"Erreur d'analyse Ollama : {exc}"}

    decisions = []
    anomalies = excel_import.erreurs if excel_import and excel_import.erreurs else []
    if anomalies:
        decisions.append({"type": "anomalies", "description": f"{len(anomalies)} anomalie(s) dans les données importées."})
    if lignes:
        decisions.append({"type": "donnees_analysees", "description": f"{len(lignes)} ligne(s) analysée(s)."})

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
        cree_par=cree_par,
    )
