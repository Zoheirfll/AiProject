from django.conf import settings
from django.db import models

from employees.models import Contract, Employee


class RegleAutomatisation(models.Model):
    class Format(models.TextChoices):
        TEXTE = "TEXTE", "Texte brut"
        HTML = "HTML", "HTML"

    class TypeCondition(models.TextChoices):
        CONTRAT = "CONTRAT", "Contrat expirant"
        CHAMP_PERSONNALISE = "CHAMP_PERSONNALISE", "Champ personnalisé"

    class Operateur(models.TextChoices):
        INFERIEUR_A = "INFERIEUR_A", "Inférieur à"
        SUPERIEUR_A = "SUPERIEUR_A", "Supérieur à"
        EGAL = "EGAL", "Égal à"
        CONTIENT = "CONTIENT", "Contient"
        VIDE = "VIDE", "Est vide / absent"

    nom = models.CharField(max_length=255)
    actif = models.BooleanField(default=True)
    type_condition = models.CharField(
        max_length=20, choices=TypeCondition.choices, default=TypeCondition.CONTRAT,
    )
    # CONTRAT mode only:
    delais_jours = models.JSONField(default=list, blank=True)
    # CHAMP_PERSONNALISE mode only — champ_cible is looked up first in
    # Employee.donnees_supplementaires (any Excel column, e.g. "jours_conges_restants"),
    # falling back to a direct system field (e.g. "poste") if not found there.
    champ_cible = models.CharField(max_length=255, blank=True)
    operateur = models.CharField(max_length=20, choices=Operateur.choices, blank=True)
    valeur_seuil = models.CharField(max_length=255, blank=True)
    departements_filtre = models.JSONField(default=list, blank=True)
    destinataires = models.JSONField(default=list, blank=True)
    cc = models.JSONField(default=list, blank=True)
    bcc = models.JSONField(default=list, blank=True)
    prompt_override = models.TextField(blank=True)
    format = models.CharField(max_length=10, choices=Format.choices, default=Format.TEXTE)
    # Owner (US: a Chargé RH recrutement's daily reminder shouldn't be visible
    # to a Chargé RH paie — DRH sees everything regardless of owner).
    cree_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="regles_creees",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class AutomatisationConfig(models.Model):
    """Singleton: global Ollama prompt + daily-report schedule (see get_solo())."""

    prompt_global = models.TextField(blank=True)
    heure_rapport_quotidien = models.TimeField(default="09:00")
    dernier_rapport_envoye = models.DateField(null=True, blank=True)

    def __str__(self):
        return "Configuration automatisations"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class AlerteEnvoyee(models.Model):
    regle = models.ForeignKey(RegleAutomatisation, on_delete=models.CASCADE, related_name="alertes")
    # Nullable because CHAMP_PERSONNALISE alerts have no contract — they're
    # deduped via cle_dedup instead (see _envoyer_alerte_champ in services.py).
    contract = models.ForeignKey(
        Contract, on_delete=models.CASCADE, related_name="alertes_envoyees", null=True, blank=True,
    )
    # Set on every alert regardless of type_condition — the display source
    # of truth for "who this alert was about" (contract.employee for CONTRAT
    # rules is duplicated here too, so history doesn't need select_related).
    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="alertes_recues", null=True, blank=True,
    )
    delai_jours = models.IntegerField(null=True, blank=True)
    # Dedup key, unique per (regle, cle_dedup): "contrat:<id>:<delai>" for
    # CONTRAT rules, "champ:<employee_id>:<champ>:<date>" for CHAMP_PERSONNALISE
    # (re-alerts at most once per day per employee while the condition holds).
    cle_dedup = models.CharField(max_length=255, blank=True)
    date_envoi = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("regle", "cle_dedup")
        ordering = ["-date_envoi"]

    def __str__(self):
        return f"{self.contract or self.cle_dedup} - J-{self.delai_jours}"


class TacheSurveillance(models.Model):
    """A generic scheduled task: watch a document, ask Ollama to analyze it,
    and email someone — either every run (digest) or only on anomaly."""

    class Frequence(models.TextChoices):
        HORAIRE = "HORAIRE", "Toutes les heures"
        QUOTIDIEN = "QUOTIDIEN", "Quotidien"

    class ModeEnvoi(models.TextChoices):
        TOUJOURS = "TOUJOURS", "Toujours (rapport périodique)"
        ANOMALIE = "ANOMALIE", "Seulement si anomalie détectée"

    nom = models.CharField(max_length=255)
    actif = models.BooleanField(default=True)
    fichier = models.FileField(upload_to="surveillance/")
    frequence = models.CharField(max_length=10, choices=Frequence.choices, default=Frequence.QUOTIDIEN)
    heure_quotidienne = models.TimeField(default="09:00")
    prompt_analyse = models.TextField(
        help_text="Ce qu'Ollama doit chercher/faire avec le contenu du document."
    )
    mode_envoi = models.CharField(max_length=10, choices=ModeEnvoi.choices, default=ModeEnvoi.ANOMALIE)
    destinataires = models.JSONField(
        default=list, blank=True,
        help_text="Emails fixes, 'departement:X', ou 'tous'.",
    )
    cc = models.JSONField(default=list, blank=True)
    bcc = models.JSONField(default=list, blank=True)
    cree_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="taches_creees",
    )
    derniere_execution = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom


class ExecutionSurveillance(models.Model):
    """Audit trail of each TacheSurveillance run, sent or not."""

    tache = models.ForeignKey(TacheSurveillance, on_delete=models.CASCADE, related_name="executions")
    envoye = models.BooleanField(default=False)
    resume = models.TextField(blank=True)
    executed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-executed_at"]

    def __str__(self):
        return f"{self.tache} - {'envoyé' if self.envoye else 'sans envoi'}"
