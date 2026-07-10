from django.contrib import admin

from .models import AlerteEnvoyee, ExecutionSurveillance, RegleAutomatisation, TacheSurveillance


@admin.register(RegleAutomatisation)
class RegleAutomatisationAdmin(admin.ModelAdmin):
    list_display = ["nom", "actif", "delais_jours", "updated_at"]


@admin.register(AlerteEnvoyee)
class AlerteEnvoyeeAdmin(admin.ModelAdmin):
    list_display = ["regle", "contract", "delai_jours", "date_envoi"]


@admin.register(TacheSurveillance)
class TacheSurveillanceAdmin(admin.ModelAdmin):
    list_display = ["nom", "actif", "frequence", "mode_envoi", "derniere_execution"]


@admin.register(ExecutionSurveillance)
class ExecutionSurveillanceAdmin(admin.ModelAdmin):
    list_display = ["tache", "envoye", "executed_at"]
