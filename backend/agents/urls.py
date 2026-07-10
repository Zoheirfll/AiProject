from django.urls import path

from .views import HealthView

app_name = "agents"

urlpatterns = [
    path("agents/health/", HealthView.as_view(), name="health"),
]
