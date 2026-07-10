from django.urls import path

from .views import HealthView

app_name = "employees"

urlpatterns = [
    path("employees/health/", HealthView.as_view(), name="health"),
]
