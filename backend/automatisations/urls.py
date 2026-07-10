from django.urls import path

from .views import (
    HealthView,
    RegleDetailView,
    RegleListCreateView,
    RegleRunView,
    RegleTestView,
    TacheSurveillanceDetailView,
    TacheSurveillanceHistoriqueView,
    TacheSurveillanceListCreateView,
    TacheSurveillanceRunView,
    TacheSurveillanceTestView,
)

app_name = "automatisations"

urlpatterns = [
    path("automatisations/health/", HealthView.as_view(), name="health"),
    path("automatisations/", RegleListCreateView.as_view(), name="regles-list"),
    path("automatisations/<int:pk>/", RegleDetailView.as_view(), name="regles-detail"),
    path("automatisations/<int:pk>/run/", RegleRunView.as_view(), name="regles-run"),
    path("automatisations/<int:pk>/test/", RegleTestView.as_view(), name="regles-test"),
    path("surveillance/", TacheSurveillanceListCreateView.as_view(), name="surveillance-list"),
    path("surveillance/<int:pk>/", TacheSurveillanceDetailView.as_view(), name="surveillance-detail"),
    path("surveillance/<int:pk>/run/", TacheSurveillanceRunView.as_view(), name="surveillance-run"),
    path("surveillance/<int:pk>/test/", TacheSurveillanceTestView.as_view(), name="surveillance-test"),
    path("surveillance/historique/", TacheSurveillanceHistoriqueView.as_view(), name="surveillance-historique"),
]
