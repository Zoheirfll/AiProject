"""Tools the chat agent can call to ground its answers in real data
(US-E6-02 "l'agent affiche les outils qu'il utilise" — transparency).

Routing is deterministic (keyword matching) rather than an LLM-driven tool
picker: local small Ollama models are unreliable at structured function
calling, and HR questions map cleanly onto a handful of intents anyway.
"""
from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

from automatisations.models import RegleAutomatisation
from employees.models import Contract, Employee


def outil_effectif_total():
    return {"effectif_total": Employee.objects.filter(actif=True).count()}


def outil_effectif_par_departement():
    data = (
        Employee.objects.filter(actif=True)
        .values("departement")
        .annotate(n=Count("id"))
        .order_by("-n")
    )
    return {
        "effectif_par_departement": {(d["departement"] or "Non renseigné"): d["n"] for d in data}
    }


def outil_contrats_expirant(jours=30):
    today = timezone.localdate()
    horizon = today + timedelta(days=jours)
    contrats = (
        Contract.objects.filter(date_fin__isnull=False, date_fin__range=(today, horizon))
        .select_related("employee")
        .order_by("date_fin")
    )
    return {
        "contrats_expirant_sous_30_jours": [
            f"{c.employee.prenom} {c.employee.nom} ({c.employee.departement or 'N/A'}) — expire le {c.date_fin}"
            for c in contrats
        ]
    }


def outil_regles_actives():
    return {
        "regles_automatisation_actives": list(
            RegleAutomatisation.objects.filter(actif=True).values_list("nom", flat=True)
        )
    }


def outil_repartition_types_contrat():
    data = Contract.objects.values("type").annotate(n=Count("id")).order_by("-n")
    return {"repartition_types_contrat": {d["type"]: d["n"] for d in data}}


# name -> (function, keywords that trigger it)
TOOLS = {
    "effectif_total": (outil_effectif_total, ["effectif", "combien d'employ", "nombre d'employ", "au total"]),
    "effectif_par_departement": (
        outil_effectif_par_departement,
        ["département", "departement", "par service", "par équipe"],
    ),
    "contrats_expirant": (outil_contrats_expirant, ["expir", "renouvel", "cdd", "fin de contrat"]),
    "repartition_types_contrat": (outil_repartition_types_contrat, ["type de contrat", "cdi", "stage", "répartition"]),
    "regles_actives": (outil_regles_actives, ["règle", "regle", "automatisation", "alerte active"]),
}

SUGGESTIONS = [
    "Combien d'employés avons-nous au total ?",
    "Quels contrats expirent dans les 30 prochains jours ?",
    "Quelle est la répartition des employés par département ?",
    "Quelles règles d'automatisation sont actives ?",
]


def route_and_call(question):
    """Return (tool_names_used, contexte_dict) for a natural-language question."""
    q = question.lower()
    used = []
    contexte = {}
    for nom, (fn, mots_cles) in TOOLS.items():
        if any(mot in q for mot in mots_cles):
            used.append(nom)
            contexte.update(fn())

    if not used:
        used.append("effectif_total")
        contexte.update(outil_effectif_total())

    return used, contexte
