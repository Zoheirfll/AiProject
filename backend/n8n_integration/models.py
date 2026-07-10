from django.db import models


class N8nApiLog(models.Model):
    """Audit trail of every call n8n makes into GRH-Auto (US-E7-02)."""

    endpoint = models.CharField(max_length=255)
    method = models.CharField(max_length=10)
    status_code = models.PositiveIntegerField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    payload_resume = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.method} {self.endpoint} -> {self.status_code}"
