from django.contrib import admin

from .models import RegleAutomatisation


@admin.register(RegleAutomatisation)
class RegleAutomatisationAdmin(admin.ModelAdmin):
    list_display = ["nom", "actif", "delais_jours", "updated_at"]
