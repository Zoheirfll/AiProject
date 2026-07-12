from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from django.views.decorators.csrf import csrf_exempt
from strawberry.django.views import AsyncGraphQLView

from config.schema import schema


class AuthenticatedGraphQLView(AsyncGraphQLView):
    """Blocks anonymous access before any resolver runs.

    Session auth only (same trust model as the REST API) — every new field
    added to the schema is automatically covered, no per-field opt-in needed.
    """

    async def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse(
                {"errors": [{"message": "Authentication required."}]}, status=401
            )
        return await super().dispatch(request, *args, **kwargs)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("accounts.urls")),
    path("api/", include("core.urls")),
    path("api/", include("employees.urls")),
    path("api/", include("agents.urls")),
    path("api/", include("integrations.urls")),
    path("api/", include("automatisations.urls")),
    path("api/", include("dashboard.urls")),
    path("api/", include("n8n_integration.urls")),
    path("graphql/", csrf_exempt(AuthenticatedGraphQLView.as_view(schema=schema))),
]
