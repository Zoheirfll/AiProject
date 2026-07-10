from django.contrib import admin

from .models import Contract, Employee


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ["matricule", "nom", "prenom", "departement", "poste", "actif"]
    search_fields = ["matricule", "nom", "prenom"]
    list_filter = ["departement", "actif"]


@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = ["employee", "type", "date_debut", "date_fin"]
    list_filter = ["type"]
