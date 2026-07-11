from django.contrib import admin

from .models import N8nApiLog, N8nApiToken


@admin.register(N8nApiToken)
class N8nApiTokenAdmin(admin.ModelAdmin):
    list_display = ["nom", "scopes", "actif", "derniere_utilisation", "created_at", "token"]
    list_filter = ["actif"]
    readonly_fields = ["token", "created_at", "derniere_utilisation"]
    fields = ["nom", "scopes", "actif", "cree_par", "token", "created_at", "derniere_utilisation"]

    def save_model(self, request, obj, form, change):
        if not change:
            obj.cree_par = request.user
        super().save_model(request, obj, form, change)


@admin.register(N8nApiLog)
class N8nApiLogAdmin(admin.ModelAdmin):
    list_display = ["method", "endpoint", "status_code", "token", "ip_address", "created_at"]
    list_filter = ["method", "status_code", "token"]
