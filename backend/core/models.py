from django.db import models


class ExcelImport(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "En cours"
        SUCCESS = "SUCCESS", "Succès"
        FAILED = "FAILED", "Échec"

    fichier = models.FileField(upload_to="imports/")
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    lignes_total = models.PositiveIntegerField(default=0)
    lignes_importees = models.PositiveIntegerField(default=0)
    lignes_erreurs = models.PositiveIntegerField(default=0)
    erreurs = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Import {self.id} - {self.status}"
