from datetime import timedelta

from django.core.mail import EmailMessage
from django.utils import timezone

from agents.ollama_client import OllamaGenerationError, generate_mail_content
from core.models import ExcelImport, MailLog
from employees.models import Contract, Employee

from .models import AlerteEnvoyee, RegleAutomatisation


def _resoudre_liste(entries):
    resolved = set()
    for entry in entries:
        if entry.startswith("departement:"):
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


def _envoyer_alerte(regle, contract, jours_restants, marquer_alerte=True):
    employee = contract.employee
    destinataires = _resoudre_liste(regle.destinataires)
    cc = _resoudre_liste(regle.cc)
    bcc = _resoudre_liste(regle.bcc)

    sujet_demande = (
        f"Alerte contrat: {employee.prenom} {employee.nom} — "
        f"expire dans {jours_restants} jours ({contract.date_fin})"
    )

    mail_log = MailLog.objects.create(
        employee=employee, regle=regle, sujet_demande=sujet_demande, cc=cc, bcc=bcc,
    )

    prompt_final = None
    if regle.prompt_override:
        prompt_final = _substituer_variables(
            regle.prompt_override,
            {
                "nom": f"{employee.prenom} {employee.nom}",
                "departement": employee.departement or "N/A",
                "date_fin": contract.date_fin.isoformat(),
                "jours_restants": str(jours_restants),
            },
        )

    try:
        result = generate_mail_content(employee, sujet_demande, prompt_final)
    except OllamaGenerationError as exc:
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = str(exc)
        mail_log.save()
        return mail_log

    mail_log.subject = result["subject"]
    mail_log.body = result["body"]

    if not destinataires:
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = "Aucun destinataire résolu pour cette règle."
        mail_log.save()
        return mail_log

    try:
        EmailMessage(
            subject=mail_log.subject, body=mail_log.body,
            to=destinataires, cc=cc or None, bcc=bcc or None,
        ).send(fail_silently=False)
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

    return mail_log


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

    corps = (
        f"Rapport quotidien RH — {today.isoformat()}\n\n"
        f"Contrats expirant sous 45 jours:\n{resume_contrats}\n\n"
        f"Imports Excel aujourd'hui: {imports_du_jour.count()}"
    )

    cibles = destinataires if destinataires is not None else (
        [settings.EMAIL_HOST_USER] if settings.EMAIL_HOST_USER else []
    )
    if not cibles:
        return None

    mail_log = MailLog.objects.create(
        sujet_demande="Rapport quotidien RH",
        subject=f"Rapport quotidien RH — {today.isoformat()}",
        body=corps,
    )
    try:
        EmailMessage(subject=mail_log.subject, body=mail_log.body, to=cibles).send(fail_silently=False)
        mail_log.status = MailLog.Status.SENT
        mail_log.sent_at = timezone.now()
    except Exception as exc:  # noqa: BLE001
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = str(exc)
    mail_log.save()
    return mail_log
