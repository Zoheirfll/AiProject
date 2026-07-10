from django.contrib import admin

from .models import AlerteEnvoyee, RegleAutomatisation


@admin.register(RegleAutomatisation)
class RegleAutomatisationAdmin(admin.ModelAdmin):
    list_display = ["nom", "actif", "delais_jours", "updated_at"]


@admin.register(AlerteEnvoyee)
class AlerteEnvoyeeAdmin(admin.ModelAdmin):
    list_display = ["regle", "contract", "delai_jours", "date_envoi"]
