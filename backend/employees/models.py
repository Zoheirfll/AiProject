from django.db import models


class Employee(models.Model):
    matricule = models.CharField(max_length=32, unique=True)
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    email = models.EmailField(blank=True)
    departement = models.CharField(max_length=100, blank=True)
    poste = models.CharField(max_length=100, blank=True)
    categorie = models.CharField(max_length=100, blank=True)
    num_contrat = models.CharField(max_length=100, blank=True)
    date_fin_contrat = models.DateField(null=True, blank=True)
    date_embauche = models.DateField(null=True, blank=True)
    actif = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nom", "prenom"]

    def __str__(self):
        return f"{self.prenom} {self.nom} ({self.matricule})"


class Contract(models.Model):
    class Type(models.TextChoices):
        CDI = "CDI", "CDI"
        CDD = "CDD", "CDD"
        STAGE = "STAGE", "Stage"
        AUTRE = "AUTRE", "Autre"

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="contracts"
    )
    type = models.CharField(max_length=10, choices=Type.choices, default=Type.CDI)
    date_debut = models.DateField()
    date_fin = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_debut"]

    def __str__(self):
        return f"{self.employee} - {self.type} ({self.date_debut})"
