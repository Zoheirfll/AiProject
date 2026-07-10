from django.db import models


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
