from django.urls import path

from .views import HealthView, RegleDetailView, RegleListCreateView, RegleRunView, RegleTestView

app_name = "automatisations"

urlpatterns = [
    path("automatisations/health/", HealthView.as_view(), name="health"),
    path("automatisations/", RegleListCreateView.as_view(), name="regles-list"),
    path("automatisations/<int:pk>/", RegleDetailView.as_view(), name="regles-detail"),
    path("automatisations/<int:pk>/run/", RegleRunView.as_view(), name="regles-run"),
    path("automatisations/<int:pk>/test/", RegleTestView.as_view(), name="regles-test"),
]
