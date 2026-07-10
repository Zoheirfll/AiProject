from django.conf import settings
from django.db import models


class AgentConfig(models.Model):
    """Singleton: per-agent Ollama model + limits (US-E6-05)."""

    modele_analyste = models.CharField(max_length=100, blank=True)
    modele_chat = models.CharField(max_length=100, blank=True)
    modele_orchestrateur = models.CharField(max_length=100, blank=True)
    timeout_secondes = models.PositiveIntegerField(default=60)
    max_iterations = models.PositiveIntegerField(default=5)
    analyste_destinataires = models.JSONField(
        default=list, blank=True,
        help_text="Emails fixes, 'departement:X', ou 'tous' — qui reçoit les alertes de l'agent analyste.",
    )

    def __str__(self):
        return "Configuration agents"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def modele(self, agent):
        return getattr(self, f"modele_{agent}", "") or settings.OLLAMA_MODEL


class AgentAnalyse(models.Model):
    """One run of the analyste agent (US-E6-01) — audit trail + report."""

    excel_import = models.ForeignKey(
        "core.ExcelImport", on_delete=models.SET_NULL, null=True, blank=True, related_name="analyses_agent",
    )
    resume = models.TextField(blank=True)
    decisions = models.JSONField(default=list, blank=True)
    alertes_envoyees = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Analyse #{self.id} ({self.created_at:%Y-%m-%d})"


class ChatConversation(models.Model):
    """A chat thread with the HR assistant (US-E6-02/03)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversations")
    titre = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.titre or f"Conversation #{self.id}"


class ChatMessage(models.Model):
    class Role(models.TextChoices):
        USER = "USER", "Utilisateur"
        ASSISTANT = "ASSISTANT", "Assistant"

    conversation = models.ForeignKey(ChatConversation, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=10, choices=Role.choices)
    content = models.TextField()
    outils_utilises = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.role}: {self.content[:50]}"


class WorkflowExecution(models.Model):
    """One run of an orchestrator workflow (US-E6-04)."""

    class TypeWorkflow(models.TextChoices):
        FIN_DE_MOIS = "FIN_DE_MOIS", "Fin de mois"
        ONBOARDING = "ONBOARDING", "Onboarding"
        AUDIT_CONTRATS = "AUDIT_CONTRATS", "Audit contrats"
        RAPPORT_HEBDO = "RAPPORT_HEBDO", "Rapport hebdo"
        PERSONNALISE = "PERSONNALISE", "Personnalisé"

    class Statut(models.TextChoices):
        EN_COURS = "EN_COURS", "En cours"
        TERMINE = "TERMINE", "Terminé"
        ECHEC = "ECHEC", "Échec"

    type_workflow = models.CharField(max_length=20, choices=TypeWorkflow.choices)
    nom = models.CharField(max_length=255)
    parametres = models.JSONField(default=dict, blank=True)
    etapes = models.JSONField(default=list, blank=True)
    statut = models.CharField(max_length=10, choices=Statut.choices, default=Statut.EN_COURS)
    cree_par = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="workflows_lances",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.nom} ({self.statut})"
