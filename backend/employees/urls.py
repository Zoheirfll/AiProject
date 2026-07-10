from django.urls import path

from .views import EmployeeListView, HealthView

app_name = "employees"

urlpatterns = [
    path("employees/health/", HealthView.as_view(), name="health"),
    path("employes/", EmployeeListView.as_view(), name="employes-list"),
]
