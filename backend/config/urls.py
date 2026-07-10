from django.contrib import admin
from django.urls import include, path
from django.views.decorators.csrf import csrf_exempt
from strawberry.django.views import AsyncGraphQLView

from config.schema import schema

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
    path("api/", include("employees.urls")),
    path("api/", include("agents.urls")),
    path("api/", include("integrations.urls")),
    path("api/", include("automatisations.urls")),
    path("api/", include("dashboard.urls")),
    path("graphql/", csrf_exempt(AsyncGraphQLView.as_view(schema=schema))),
]
