from django.urls import path

from .views import (
    ActiviteRecenteView,
    AutomatisationsTypesView,
    ContratsParMoisView,
    HealthView,
    KpisView,
    MailsEvolutionView,
)

app_name = "dashboard"

urlpatterns = [
    path("dashboard/health/", HealthView.as_view(), name="health"),
    path("dashboard/kpis/", KpisView.as_view(), name="kpis"),
    path("dashboard/mails-evolution/", MailsEvolutionView.as_view(), name="mails-evolution"),
    path("dashboard/automatisations-types/", AutomatisationsTypesView.as_view(), name="automatisations-types"),
    path("dashboard/contrats-par-mois/", ContratsParMoisView.as_view(), name="contrats-par-mois"),
    path("dashboard/activite/", ActiviteRecenteView.as_view(), name="activite"),
]
