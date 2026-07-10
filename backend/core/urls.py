from django.urls import path

from .views import (
    ConfigView,
    HealthView,
    ImportHistoryView,
    ImportUploadView,
    MailApercuView,
    MailEnvoyerView,
    MailHistoriqueView,
    SmtpTestView,
)

app_name = "core"

urlpatterns = [
    path("core/health/", HealthView.as_view(), name="health"),
    path("imports/upload/", ImportUploadView.as_view(), name="imports-upload"),
    path("imports/historique/", ImportHistoryView.as_view(), name="imports-historique"),
    path("mails/apercu/", MailApercuView.as_view(), name="mails-apercu"),
    path("mails/envoyer/", MailEnvoyerView.as_view(), name="mails-envoyer"),
    path("mails/historique/", MailHistoriqueView.as_view(), name="mails-historique"),
    path("config/", ConfigView.as_view(), name="config"),
    path("config/smtp/test/", SmtpTestView.as_view(), name="config-smtp-test"),
]
