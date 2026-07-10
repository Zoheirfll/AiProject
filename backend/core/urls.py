from django.urls import path

from .views import (
    ConfigView,
    HealthView,
    ImportHistoryView,
    ImportUploadView,
    MailApercuMasseView,
    MailApercuView,
    MailEnvoyerMasseView,
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
    path("mails/apercu-masse/", MailApercuMasseView.as_view(), name="mails-apercu-masse"),
    path("mails/envoyer/", MailEnvoyerView.as_view(), name="mails-envoyer"),
    path("mails/envoyer-masse/", MailEnvoyerMasseView.as_view(), name="mails-envoyer-masse"),
    path("mails/historique/", MailHistoriqueView.as_view(), name="mails-historique"),
    path("config/", ConfigView.as_view(), name="config"),
    path("config/smtp/test/", SmtpTestView.as_view(), name="config-smtp-test"),
]
