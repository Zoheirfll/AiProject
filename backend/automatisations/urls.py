from django.urls import path

from .views import HealthView, RegleDetailView, RegleListCreateView

app_name = "automatisations"

urlpatterns = [
    path("automatisations/health/", HealthView.as_view(), name="health"),
    path("automatisations/", RegleListCreateView.as_view(), name="regles-list"),
    path("automatisations/<int:pk>/", RegleDetailView.as_view(), name="regles-detail"),
]
