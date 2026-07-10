from django.urls import path

from .views import HealthView, ImportHistoryView, ImportUploadView

app_name = "core"

urlpatterns = [
    path("core/health/", HealthView.as_view(), name="health"),
    path("imports/upload/", ImportUploadView.as_view(), name="imports-upload"),
    path("imports/historique/", ImportHistoryView.as_view(), name="imports-historique"),
]
