from django.contrib import admin

from .models import ExcelImport


@admin.register(ExcelImport)
class ExcelImportAdmin(admin.ModelAdmin):
    list_display = ["id", "status", "lignes_total", "lignes_importees", "lignes_erreurs", "created_at"]
    list_filter = ["status"]
