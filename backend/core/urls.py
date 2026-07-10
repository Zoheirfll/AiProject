from django.urls import path

from .views import (
    ConfigView,
    HealthView,
    ImportHistoryView,
    ImportUploadView,
    MailApercuView,
)

app_name = "core"

urlpatterns = [
    path("core/health/", HealthView.as_view(), name="health"),
    path("imports/upload/", ImportUploadView.as_view(), name="imports-upload"),
    path("imports/historique/", ImportHistoryView.as_view(), name="imports-historique"),
    path("mails/apercu/", MailApercuView.as_view(), name="mails-apercu"),
    path("config/", ConfigView.as_view(), name="config"),
]
