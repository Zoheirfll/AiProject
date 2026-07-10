from django.urls import path

from .views import (
    HealthView,
    N8nContratsExpirantsView,
    N8nEmployesView,
    N8nEnvoyerMailView,
    N8nLogView,
)

app_name = "n8n_integration"

urlpatterns = [
    path("n8n/health/", HealthView.as_view(), name="health"),
    path("n8n/employes/", N8nEmployesView.as_view(), name="n8n-employes"),
    path("n8n/contrats-expirants/", N8nContratsExpirantsView.as_view(), name="n8n-contrats-expirants"),
    path("n8n/mails/envoyer/", N8nEnvoyerMailView.as_view(), name="n8n-mails-envoyer"),
    path("n8n/logs/", N8nLogView.as_view(), name="n8n-logs"),
]
