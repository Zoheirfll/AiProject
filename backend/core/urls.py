from django.urls import path

from .views import (
    ConfigView,
    HealthView,
    ImportDeleteView,
    ImportHistoryView,
    ImportMappingView,
    ImportModeleView,
    ImportUploadView,
    MailApercuMasseView,
    MailApercuView,
    MailEnvoyerMasseView,
    MailEnvoyerView,
    MailHistoriqueExportView,
    MailHistoriqueView,
    SmtpTestView,
    TechnicalLogView,
)

app_name = "core"

urlpatterns = [
    path("core/health/", HealthView.as_view(), name="health"),
    path("imports/upload/", ImportUploadView.as_view(), name="imports-upload"),
    path("imports/modele/", ImportModeleView.as_view(), name="imports-modele"),
    path("imports/historique/", ImportHistoryView.as_view(), name="imports-historique"),
    path("imports/<int:pk>/", ImportDeleteView.as_view(), name="imports-delete"),
    path("imports/mapping/", ImportMappingView.as_view(), name="imports-mapping"),
    path("mails/apercu/", MailApercuView.as_view(), name="mails-apercu"),
    path("mails/apercu-masse/", MailApercuMasseView.as_view(), name="mails-apercu-masse"),
    path("mails/envoyer/", MailEnvoyerView.as_view(), name="mails-envoyer"),
    path("mails/envoyer-masse/", MailEnvoyerMasseView.as_view(), name="mails-envoyer-masse"),
    path("mails/historique/", MailHistoriqueView.as_view(), name="mails-historique"),
    path("mails/historique/export/", MailHistoriqueExportView.as_view(), name="mails-historique-export"),
    path("logs/", TechnicalLogView.as_view(), name="logs"),
    path("config/", ConfigView.as_view(), name="config"),
    path("config/smtp/test/", SmtpTestView.as_view(), name="config-smtp-test"),
]
