"""Orchestrator agent (US-E6-04), deliberately scoped down: predefined
workflows are ordered lists of vetted Python step functions, not arbitrary
LLM-generated code. "Custom workflow in natural language" asks Ollama to
pick and order a subset of these same vetted steps — the model can choose
*which* known steps to run and in what order, but can never invent a step
that doesn't exist. This keeps a local, small model's unreliability from
ever translating into unsafe or nonsensical actions.
"""
from datetime import timedelta

from django.utils import timezone

from .models import AgentConfig, WorkflowExecution
from .ollama_client import OllamaGenerationError, _chat, _default_model, generate_mail_content


def _etape_verifier_contrats_expirant(execution):
    from employees.models import Contract

    today = timezone.localdate()
    horizon = today + timedelta(days=30)
    contrats = Contract.objects.filter(date_fin__isnull=False, date_fin__range=(today, horizon))
    n = contrats.count()
    execution.parametres["contrats_expirant_ids"] = list(contrats.values_list("id", flat=True))
    return f"{n} contrat(s) expirant sous 30 jours détecté(s)."


def _etape_generer_rapport(execution):
    from employees.models import Contract, Employee

    effectif = Employee.objects.filter(actif=True).count()
    sans_date_fin = Contract.objects.filter(date_fin__isnull=True).count()
    resume = f"Effectif actif: {effectif}. Contrats sans date de fin (CDI): {sans_date_fin}."
    execution.parametres["dernier_rapport"] = resume
    return resume


def _etape_auditer_contrats(execution):
    from employees.models import Contract

    anomalies = [
        f"{c.employee} : contrat CDD sans date de fin"
        for c in Contract.objects.select_related("employee").filter(
            type=Contract.Type.CDD, date_fin__isnull=True
        )
    ]
    execution.parametres["anomalies"] = anomalies
    return f"{len(anomalies)} anomalie(s) détectée(s)." if anomalies else "Aucune anomalie détectée."


def _etape_verifier_fiche_employe(execution):
    from employees.models import Employee

    matricule = execution.parametres.get("matricule")
    if not matricule:
        raise ValueError("Paramètre 'matricule' requis pour l'onboarding.")
    try:
        employee = Employee.objects.get(matricule=matricule)
    except Employee.DoesNotExist as exc:
        raise ValueError(f"Employé matricule={matricule} introuvable.") from exc

    manquants = [f for f in ["email", "poste", "departement"] if not getattr(employee, f)]
    if manquants:
        raise ValueError(f"Champs manquants sur la fiche employé: {', '.join(manquants)}.")
    return f"Fiche complète pour {employee.prenom} {employee.nom}."


def _etape_envoyer_mail_bienvenue(execution):
    from core.models import MailLog
    from core.services import send_mail_log
    from employees.models import Employee

    matricule = execution.parametres.get("matricule")
    employee = Employee.objects.get(matricule=matricule)
    config = AgentConfig.get_solo()

    try:
        result = generate_mail_content(
            employee, "Mail de bienvenue pour un nouvel employé", model=config.modele("orchestrateur")
        )
    except OllamaGenerationError as exc:
        raise ValueError(f"Échec de génération du mail: {exc}") from exc

    mail_log = MailLog.objects.create(
        employee=employee, sujet_demande="Bienvenue", subject=result["subject"], body=result["body"],
    )
    if not employee.email:
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = "Aucun email pour cet employé."
        mail_log.save()
        raise ValueError("Aucun email pour cet employé — mail non envoyé.")

    try:
        send_mail_log(mail_log, [employee.email])
        mail_log.status = MailLog.Status.SENT
        mail_log.sent_at = timezone.now()
    except Exception as exc:  # noqa: BLE001
        mail_log.status = MailLog.Status.FAILED
        mail_log.erreur = str(exc)
        mail_log.save()
        raise
    mail_log.save()
    return f"Mail de bienvenue envoyé à {employee.email}."


def _etape_notifier_departement(execution):
    from integrations.notifications import notify

    notify(
        {
            "type": "workflow_notification",
            "message": f"Workflow « {execution.nom} » : notification déclenchée.",
        }
    )
    return "Notification envoyée."


STEP_PRIMITIVES = {
    "verifier_contrats_expirant": ("Vérifier les contrats expirant bientôt", _etape_verifier_contrats_expirant),
    "generer_rapport": ("Générer un rapport de synthèse RH", _etape_generer_rapport),
    "auditer_contrats": ("Auditer les contrats (anomalies)", _etape_auditer_contrats),
    "verifier_fiche_employe": ("Vérifier la fiche de l'employé", _etape_verifier_fiche_employe),
    "envoyer_mail_bienvenue": ("Envoyer le mail de bienvenue", _etape_envoyer_mail_bienvenue),
    "notifier_departement": ("Notifier le département concerné", _etape_notifier_departement),
}

WORKFLOW_DEFINITIONS = {
    WorkflowExecution.TypeWorkflow.FIN_DE_MOIS: ["verifier_contrats_expirant", "generer_rapport", "notifier_departement"],
    WorkflowExecution.TypeWorkflow.ONBOARDING: ["verifier_fiche_employe", "envoyer_mail_bienvenue", "notifier_departement"],
    WorkflowExecution.TypeWorkflow.AUDIT_CONTRATS: ["auditer_contrats", "generer_rapport"],
    WorkflowExecution.TypeWorkflow.RAPPORT_HEBDO: ["verifier_contrats_expirant", "generer_rapport"],
}

WORKFLOW_LABELS = {
    WorkflowExecution.TypeWorkflow.FIN_DE_MOIS: "Fin de mois",
    WorkflowExecution.TypeWorkflow.ONBOARDING: "Onboarding",
    WorkflowExecution.TypeWorkflow.AUDIT_CONTRATS: "Audit contrats",
    WorkflowExecution.TypeWorkflow.RAPPORT_HEBDO: "Rapport hebdo",
}


def _notifier_etape(execution):
    from integrations.notifications import notify

    notify(
        {
            "type": "workflow",
            "execution_id": execution.id,
            "etapes": execution.etapes,
            "statut": execution.statut,
        }
    )


def lancer_workflow(execution, reprise_depuis=None):
    """Run execution.etapes starting at reprise_depuis (or from scratch if
    None), pushing a WS notification after every step so the frontend
    stepper updates live. Stops and marks ECHEC on the first failing step —
    US-E6-04's "reprise sur erreur" means resuming from exactly that step."""
    if not execution.etapes:
        slugs = WORKFLOW_DEFINITIONS.get(execution.type_workflow, [])
        execution.etapes = [
            {"slug": s, "nom": STEP_PRIMITIVES[s][0], "statut": "EN_ATTENTE", "resultat": "", "erreur": ""}
            for s in slugs
        ]
        execution.save(update_fields=["etapes"])

    start = reprise_depuis if reprise_depuis is not None else 0

    for i in range(start, len(execution.etapes)):
        etape = execution.etapes[i]
        etape["statut"] = "EN_COURS"
        etape["erreur"] = ""
        execution.save(update_fields=["etapes"])
        _notifier_etape(execution)

        try:
            _, fn = STEP_PRIMITIVES[etape["slug"]]
            resultat = fn(execution)
            etape["statut"] = "TERMINE"
            etape["resultat"] = resultat
            execution.save(update_fields=["etapes", "parametres"])
        except Exception as exc:  # noqa: BLE001
            etape["statut"] = "ECHEC"
            etape["erreur"] = str(exc)
            execution.statut = WorkflowExecution.Statut.ECHEC
            execution.save(update_fields=["etapes", "statut", "parametres"])
            _notifier_etape(execution)
            return execution

        _notifier_etape(execution)

    execution.statut = WorkflowExecution.Statut.TERMINE
    execution.save(update_fields=["statut"])
    _notifier_etape(execution)
    return execution


def planifier_workflow_personnalise(instruction, model=None):
    """Ask Ollama to choose & order known step primitives for a free-text
    instruction. Returns a validated list of step slugs — never anything
    outside STEP_PRIMITIVES. Raises OllamaGenerationError if unreachable or
    if the model proposed nothing valid."""
    noms_disponibles = "\n".join(f"- {slug}: {label}" for slug, (label, _fn) in STEP_PRIMITIVES.items())
    system_prompt = (
        "Tu es un planificateur de workflows RH. Voici les étapes disponibles:\n"
        f"{noms_disponibles}\n\n"
        "Choisis et ordonne les étapes pertinentes pour la demande de l'utilisateur. "
        "Réponds STRICTEMENT avec les identifiants d'étapes séparés par des virgules, "
        "sans aucun autre texte. Exemple: verifier_contrats_expirant,generer_rapport"
    )

    try:
        content = _chat(
            model or _default_model(),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": instruction},
            ],
            options={"num_predict": 100},
        )
    except Exception as exc:  # noqa: BLE001
        raise OllamaGenerationError(f"LLM injoignable ou modèle absent: {exc}") from exc

    slugs = [s.strip() for s in content.replace("\n", ",").split(",") if s.strip()]
    valides = [s for s in slugs if s in STEP_PRIMITIVES]

    if not valides:
        raise OllamaGenerationError("Le modèle n'a proposé aucune étape valide pour cette demande.")
    return valides
