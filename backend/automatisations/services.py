import logging
from datetime import timedelta

from django.core.mail import EmailMessage
from django.utils import timezone

from agents.ollama_client import OllamaGenerationError, analyser_document, generate_mail_content
from core.models import ExcelImport, MailLog
from core.services import send_mail_log
from employees.models import Contract, Employee

from .models import (
    AlerteEnvoyee,
    AutomatisationConfig,
    ExecutionSurveillance,
    RegleAutomatisation,
    TacheSurveillance,
)

logger = logging.getLogger("grh_auto.automatisations")

DEFAULT_RAPPORT_PROMPT = (
    "Tu es un assistant RH. Rédige un rapport quotidien professionnel en "
    "français résumant les informations fournies (contrats qui expirent "
    "bientôt, imports du jour)."
)


def _resoudre_liste(entries):
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


def _substituer_variables(prompt, variables):
    resultat = prompt
    for cle, valeur in variables.items():
        resultat = resultat.replace("{{" + cle + "}}", valeur)
    return resultat


def _rendre_prompt(regle, employee, contract, jours_restants):
    """Resolve the prompt to use for this alert: rule override wins, else
    the global prompt (US-E3-03), with {{...}} variables substituted."""
    template = regle.prompt_override or AutomatisationConfig.get_solo().prompt_global
    if not template:
        return None
    return _substituer_variables(
        template,
        {
            "nom": f"{employee.prenom} {employee.nom}",
            "departement": employee.departement or "N/A",
            "date_fin": contract.date_fin.isoformat(),
            "jours_restants": str(jours_restants),
        },
    )


def _envoyer_alerte(regle, contract, jours_restants, marquer_alerte=True, test_email=None):
    employee = contract.employee
    destinataires = [test_email] if test_email else _resoudre_liste(regle.destinataires)
    cc = [] if test_email else _resoudre_liste(regle.cc)
    bcc = [] if test_email else _resoudre_liste(regle.bcc)

    sujet_demande = (
        f"Alerte contrat: {employee.prenom} {employee.nom} — "
        f"expire dans {jours_restants} jours ({contract.date_fin})"
    )

    mail_log = MailLog.objects.create(
        employee=employee, regle=regle, sujet_demande=sujet_demande, cc=cc, bcc=bcc,
        format=regle.format,
    )

    prompt_final = _rendre_prompt(regle, employee, contract, jours_restants)

    try:
        result = generate_mail_content(employee, sujet_demande, prompt_final, format=regle.format)
    except OllamaGenerationError as exc:
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = str(exc)
        mail_log.save()
        logger.error("Erreur Ollama lors de l'alerte '%s': %s", regle.nom, exc)
        from integrations.notifications import notify

        notify({"type": "erreur_ollama", "contexte": f"règle '{regle.nom}'", "detail": str(exc)})
        return mail_log

    mail_log.subject = result["subject"]
    mail_log.body = result["body"]

    if not destinataires:
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = "Aucun destinataire résolu pour cette règle."
        mail_log.save()
        return mail_log

    try:
        send_mail_log(mail_log, destinataires, cc=cc, bcc=bcc)
    except Exception as exc:  # noqa: BLE001
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = str(exc)
        mail_log.save()
        return mail_log

    mail_log.status = MailLog.Status.SENT
    mail_log.sent_at = timezone.now()
    mail_log.save()

    if marquer_alerte:
        AlerteEnvoyee.objects.create(regle=regle, contract=contract, delai_jours=jours_restants)
        from integrations.notifications import notify

        notify({"type": "alerte", "regle": regle.nom, "employee": str(employee)})

    return mail_log


def apercu_regle(regle):
    """US-E3-01: preview which employees/contracts would trigger this rule
    right now, without sending anything. Includes the rendered prompt for
    the first match (US-E3-03 prompt preview)."""
    today = timezone.localdate()
    contracts = Contract.objects.filter(date_fin__isnull=False).select_related("employee")
    if regle.departements_filtre:
        contracts = contracts.filter(employee__departement__in=regle.departements_filtre)

    resultats = []
    for contract in contracts:
        jours_restants = (contract.date_fin - today).days
        if jours_restants not in regle.delais_jours:
            continue
        deja_envoye = AlerteEnvoyee.objects.filter(
            regle=regle, contract=contract, delai_jours=jours_restants
        ).exists()
        resultats.append(
            {
                "employee_id": contract.employee_id,
                "nom": f"{contract.employee.prenom} {contract.employee.nom}",
                "departement": contract.employee.departement,
                "date_fin": contract.date_fin,
                "jours_restants": jours_restants,
                "deja_envoye": deja_envoye,
            }
        )

    prompt_rendu = None
    if resultats:
        premier = next(
            c for c in contracts
            if (c.date_fin - today).days == resultats[0]["jours_restants"]
            and c.employee_id == resultats[0]["employee_id"]
        )
        prompt_rendu = _rendre_prompt(regle, premier.employee, premier, resultats[0]["jours_restants"])

    destinataires_resolus = _resoudre_liste(regle.destinataires)

    return {
        "employes_concernes": resultats,
        "destinataires_resolus": destinataires_resolus,
        "prompt_rendu": prompt_rendu,
    }


def evaluer_regles(regle_id=None):
    regles = RegleAutomatisation.objects.filter(actif=True)
    if regle_id is not None:
        regles = regles.filter(pk=regle_id)

    today = timezone.localdate()
    resultats = []

    for regle in regles:
        contracts = Contract.objects.filter(date_fin__isnull=False).select_related("employee")
        if regle.departements_filtre:
            contracts = contracts.filter(employee__departement__in=regle.departements_filtre)

        for contract in contracts:
            jours_restants = (contract.date_fin - today).days
            if jours_restants not in regle.delais_jours:
                continue
            if AlerteEnvoyee.objects.filter(
                regle=regle, contract=contract, delai_jours=jours_restants
            ).exists():
                continue
            try:
                resultats.append(_envoyer_alerte(regle, contract, jours_restants))
            except Exception:  # noqa: BLE001
                # Isolate per-contract failures so one bad contract/rule never
                # aborts processing of the remaining contracts/regles.
                continue

    return resultats


def generer_rapport_quotidien(destinataires=None):
    """US-E3-02: daily digest, its content generated by Ollama from the
    global prompt (AutomatisationConfig.prompt_global, or a sane default)."""
    from django.conf import settings

    today = timezone.localdate()
    horizon = today + timedelta(days=45)
    contrats_proches = Contract.objects.filter(
        date_fin__isnull=False, date_fin__range=(today, horizon)
    ).select_related("employee")
    imports_du_jour = ExcelImport.objects.filter(created_at__date=today)

    lignes = [
        f"- {c.employee.prenom} {c.employee.nom} ({c.employee.departement or 'N/A'}): expire le {c.date_fin}"
        for c in contrats_proches
    ]
    resume_contrats = "\n".join(lignes) or "Aucun contrat n'expire dans les 45 prochains jours."

    contenu = (
        f"Date: {today.isoformat()}\n\n"
        f"Contrats expirant sous 45 jours:\n{resume_contrats}\n\n"
        f"Imports Excel aujourd'hui: {imports_du_jour.count()}"
    )

    cibles = destinataires if destinataires is not None else (
        [settings.EMAIL_HOST_USER] if settings.EMAIL_HOST_USER else []
    )
    if not cibles:
        return None

    prompt = AutomatisationConfig.get_solo().prompt_global or DEFAULT_RAPPORT_PROMPT

    mail_log = MailLog.objects.create(sujet_demande="Rapport quotidien RH")

    try:
        analyse = analyser_document(prompt, contenu, forcer_envoi=True)
    except OllamaGenerationError as exc:
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = str(exc)
        mail_log.save()
        logger.error("Erreur Ollama lors du rapport quotidien: %s", exc)
        from integrations.notifications import notify

        notify({"type": "erreur_ollama", "contexte": "rapport quotidien", "detail": str(exc)})
        return mail_log

    mail_log.subject = analyse["subject"]
    mail_log.body = analyse["body"]

    try:
        EmailMessage(subject=mail_log.subject, body=mail_log.body, to=cibles).send(fail_silently=False)
        mail_log.status = MailLog.Status.SENT
        mail_log.sent_at = timezone.now()
    except Exception as exc:  # noqa: BLE001
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = str(exc)
    mail_log.save()
    return mail_log


def verifier_rapport_quotidien():
    """Scheduler tick (every 5 min): send the daily report once per day,
    at the configured hour (AutomatisationConfig.heure_rapport_quotidien)."""
    config = AutomatisationConfig.get_solo()
    now = timezone.localtime()

    if now.time() < config.heure_rapport_quotidien:
        return None
    if config.dernier_rapport_envoye == now.date():
        return None

    resultat = generer_rapport_quotidien()
    config.dernier_rapport_envoye = now.date()
    config.save(update_fields=["dernier_rapport_envoye"])
    return resultat


def _lire_contenu_fichier(fichier):
    """Read a watched document as plain text for Ollama analysis.

    Excel files are flattened to comma-separated rows; anything else is
    decoded as text (best-effort).
    """
    nom = (fichier.name or "").lower()

    if nom.endswith((".xlsx", ".xls")):
        import openpyxl

        workbook = openpyxl.load_workbook(fichier, data_only=True)
        sheet = workbook.active
        lignes = [
            ", ".join("" if cell is None else str(cell) for cell in row)
            for row in sheet.iter_rows(values_only=True)
        ]
        return "\n".join(lignes)

    fichier.seek(0)
    return fichier.read().decode("utf-8", errors="replace")


def _tache_est_due(tache, now):
    if tache.frequence == TacheSurveillance.Frequence.HORAIRE:
        if tache.derniere_execution is None:
            return True
        return now - tache.derniere_execution >= timedelta(hours=1)

    # QUOTIDIEN: wait for the configured time of day, even on the very
    # first run, then fire at most once per calendar day after that.
    if now.time() < tache.heure_quotidienne:
        return False
    if tache.derniere_execution is None:
        return True
    return tache.derniere_execution.astimezone(now.tzinfo).date() < now.date()


def _executer_tache(tache, marquer_execution=True):
    """Run one TacheSurveillance now: read, analyze, and email if warranted."""
    try:
        contenu = _lire_contenu_fichier(tache.fichier)
    except Exception as exc:  # noqa: BLE001
        return _finaliser_execution(tache, marquer_execution, envoye=False, resume=f"Erreur de lecture du fichier: {exc}")

    forcer_envoi = tache.mode_envoi == TacheSurveillance.ModeEnvoi.TOUJOURS

    try:
        analyse = analyser_document(tache.prompt_analyse, contenu, forcer_envoi)
    except OllamaGenerationError as exc:
        logger.error("Erreur Ollama lors de la surveillance '%s': %s", tache.nom, exc)
        from integrations.notifications import notify

        notify({"type": "erreur_ollama", "contexte": f"surveillance '{tache.nom}'", "detail": str(exc)})
        return _finaliser_execution(tache, marquer_execution, envoye=False, resume=f"Erreur Ollama: {exc}")

    if not analyse["envoyer"]:
        resume = analyse["body"] or "Aucune anomalie détectée."
        return _finaliser_execution(tache, marquer_execution, envoye=False, resume=resume)

    destinataires = _resoudre_liste(tache.destinataires)
    cc = _resoudre_liste(tache.cc)
    bcc = _resoudre_liste(tache.bcc)

    mail_log = MailLog.objects.create(
        sujet_demande=f"Surveillance: {tache.nom}",
        subject=analyse["subject"],
        body=analyse["body"],
        cc=cc,
        bcc=bcc,
    )

    if not destinataires:
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = "Aucun destinataire résolu pour cette tâche."
        mail_log.save()
        return _finaliser_execution(tache, marquer_execution, envoye=False, resume="Aucun destinataire résolu.")

    try:
        EmailMessage(
            subject=mail_log.subject, body=mail_log.body,
            to=destinataires, cc=cc or None, bcc=bcc or None,
        ).send(fail_silently=False)
    except Exception as exc:  # noqa: BLE001
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = str(exc)
        mail_log.save()
        return _finaliser_execution(tache, marquer_execution, envoye=False, resume=f"Erreur d'envoi: {exc}")

    mail_log.status = MailLog.Status.SENT
    mail_log.sent_at = timezone.now()
    mail_log.save()

    return _finaliser_execution(tache, marquer_execution, envoye=True, resume=analyse["body"][:500])


def _finaliser_execution(tache, marquer_execution, envoye, resume):
    execution = ExecutionSurveillance.objects.create(tache=tache, envoye=envoye, resume=resume)
    if marquer_execution:
        tache.derniere_execution = timezone.now()
        tache.save(update_fields=["derniere_execution"])
    if envoye:
        from integrations.notifications import notify

        notify({"type": "surveillance", "tache": tache.nom})
    return execution


def evaluer_taches_surveillance():
    """Scheduler tick: run every active TacheSurveillance that is due."""
    now = timezone.now()
    resultats = []

    for tache in TacheSurveillance.objects.filter(actif=True):
        if not _tache_est_due(tache, now):
            continue
        try:
            resultats.append(_executer_tache(tache))
        except Exception:  # noqa: BLE001
            continue

    return resultats
