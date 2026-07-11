import secrets

from django.conf import settings
from django.db import models


class N8nApiToken(models.Model):
    """A scoped bearer token for one n8n workflow (or small group of them) —
    replaces a single global token so a workflow that only needs to read
    contracts can't also send mails, and any one token can be revoked
    (actif=False) without affecting the others."""

    class Scope(models.TextChoices):
        EMPLOYES_READ = "employes:read", "Lire les employés"
        CONTRATS_READ = "contrats:read", "Lire les contrats expirants"
        MAILS_SEND = "mails:send", "Envoyer des mails"
        LOGS_WRITE = "logs:write", "Écrire des logs"

    nom = models.CharField(max_length=255, help_text="Ex: « Workflow rapport quotidien »")
    token = models.CharField(max_length=64, unique=True, editable=False)
    scopes = models.JSONField(
        default=list, blank=True,
        help_text="Sous-ensemble de: employes:read, contrats:read, mails:send, logs:write",
    )
    actif = models.BooleanField(default=True)
    cree_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="n8n_tokens_crees",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    derniere_utilisation = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.nom} ({'actif' if self.actif else 'révoqué'})"

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)


class N8nApiLog(models.Model):
    """Audit trail of every call n8n makes into GRH-Auto (US-E7-02)."""

    endpoint = models.CharField(max_length=255)
    method = models.CharField(max_length=10)
    status_code = models.PositiveIntegerField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    payload_resume = models.TextField(blank=True)
    token = models.ForeignKey(
        N8nApiToken, on_delete=models.SET_NULL, null=True, blank=True, related_name="appels",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.method} {self.endpoint} -> {self.status_code}"
