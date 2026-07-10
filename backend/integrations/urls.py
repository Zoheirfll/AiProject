from django.urls import path

from .views import HealthView

app_name = "integrations"

urlpatterns = [
    path("integrations/health/", HealthView.as_view(), name="health"),
]
