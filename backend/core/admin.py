from django.contrib import admin

from .models import ExcelImport, MailLog


@admin.register(ExcelImport)
class ExcelImportAdmin(admin.ModelAdmin):
    list_display = ["id", "status", "lignes_total", "lignes_importees", "lignes_erreurs", "created_at"]
    list_filter = ["status"]


@admin.register(MailLog)
class MailLogAdmin(admin.ModelAdmin):
    list_display = ["id", "employee", "sujet_demande", "status", "created_at"]
    list_filter = ["status"]
