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


class MailLog(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Brouillon"
        SENT = "SENT", "Envoyé"
        FAILED = "FAILED", "Échec"

    class Format(models.TextChoices):
        TEXTE = "TEXTE", "Texte"
        HTML = "HTML", "HTML"

    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mails",
    )
    regle = models.ForeignKey(
        "automatisations.RegleAutomatisation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mails",
    )
    sujet_demande = models.CharField(max_length=255)
    subject = models.CharField(max_length=255, blank=True)
    body = models.TextField(blank=True)
    format = models.CharField(max_length=10, choices=Format.choices, default=Format.TEXTE)
    cc = models.JSONField(default=list, blank=True)
    bcc = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    erreur = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Mail {self.id} - {self.status}"
