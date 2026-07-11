from django.conf import settings
from django.db import models


class ExcelImport(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "En cours"
        SUCCESS = "SUCCESS", "Succès"
        FAILED = "FAILED", "Échec"

    class Source(models.TextChoices):
        UPLOAD = "UPLOAD", "Upload manuel"
        DOSSIER = "DOSSIER", "Dossier surveillé"

    fichier = models.FileField(upload_to="imports/")
    nom_fichier_origine = models.CharField(max_length=255, blank=True)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.UPLOAD)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    lignes_total = models.PositiveIntegerField(default=0)
    lignes_importees = models.PositiveIntegerField(default=0)
    lignes_erreurs = models.PositiveIntegerField(default=0)
    erreurs = models.JSONField(default=list, blank=True)
    # Owner (US: a Chargé RH shouldn't see another Chargé RH's imports; DRH
    # sees everything). Null for folder-watch imports (no request.user in
    # that background job context) — ownerless rows stay visible to
    # everyone, same convention as automatisations.RegleAutomatisation.
    cree_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="imports_crees",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Import {self.id} - {self.status}"


IMPORT_MAPPING_FIELDS = [
    "matricule",
    "nom",
    "prenom",
    "email",
    "departement",
    "poste",
    "categorie",
    "num_contrat",
    "date_embauche",
    "date_fin_contrat",
]


class ImportConfig(models.Model):
    """Singleton holding the column mapping and the watched-folder path.

    Only one row is ever used (pk=1) — see ImportConfig.get_solo().
    """

    mapping = models.JSONField(
        default=dict, blank=True,
        help_text="system_field -> excel column header (lowercase)",
    )
    dossier_surveille = models.CharField(max_length=500, blank=True)

    def __str__(self):
        return "Configuration import"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


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
    destinataire_nom = models.CharField(max_length=200, blank=True)
    destinataire_email = models.EmailField(blank=True)
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

    @property
    def email_destinataire(self):
        if self.employee:
            return self.employee.email
        return self.destinataire_email

    @property
    def nom_destinataire(self):
        if self.employee:
            return f"{self.employee.prenom} {self.employee.nom}"
        return self.destinataire_nom


class TechnicalLog(models.Model):
    """Every INFO+ log record emitted app-wide, mirrored into the DB by
    core.logging_handlers.DatabaseLogHandler (see LOGGING in settings/base.py)."""

    class Level(models.TextChoices):
        INFO = "INFO", "Info"
        WARNING = "WARNING", "Avertissement"
        ERROR = "ERROR", "Erreur"

    created_at = models.DateTimeField(auto_now_add=True)
    level = models.CharField(max_length=10, choices=Level.choices)
    logger_name = models.CharField(max_length=200)
    message = models.TextField()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["level"]),
        ]

    def __str__(self):
        return f"[{self.level}] {self.logger_name}: {self.message[:50]}"
