from django.db import models

from employees.models import Contract


class RegleAutomatisation(models.Model):
    nom = models.CharField(max_length=255)
    actif = models.BooleanField(default=True)
    delais_jours = models.JSONField(default=list, blank=True)
    departements_filtre = models.JSONField(default=list, blank=True)
    destinataires = models.JSONField(default=list, blank=True)
    cc = models.JSONField(default=list, blank=True)
    bcc = models.JSONField(default=list, blank=True)
    prompt_override = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nom"]

    def __str__(self):
        return self.nom


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
