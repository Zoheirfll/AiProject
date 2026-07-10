from django.db import models

from employees.models import Contract


class RegleAutomatisation(models.Model):
    class Format(models.TextChoices):
        TEXTE = "TEXTE", "Texte brut"
        HTML = "HTML", "HTML"

    nom = models.CharField(max_length=255)
    actif = models.BooleanField(default=True)
    delais_jours = models.JSONField(default=list, blank=True)
    departements_filtre = models.JSONField(default=list, blank=True)
    destinataires = models.JSONField(default=list, blank=True)
    cc = models.JSONField(default=list, blank=True)
    bcc = models.JSONField(default=list, blank=True)
    prompt_override = models.TextField(blank=True)
    format = models.CharField(max_length=10, choices=Format.choices, default=Format.TEXTE)
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
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="alertes_envoyees")
    delai_jours = models.IntegerField()
    date_envoi = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("regle", "contract", "delai_jours")
        ordering = ["-date_envoi"]

    def __str__(self):
        return f"{self.contract} - J-{self.delai_jours}"


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
