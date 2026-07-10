from django.contrib import admin

from .models import N8nApiLog


@admin.register(N8nApiLog)
class N8nApiLogAdmin(admin.ModelAdmin):
    list_display = ["method", "endpoint", "status_code", "ip_address", "created_at"]
    list_filter = ["method", "status_code"]
