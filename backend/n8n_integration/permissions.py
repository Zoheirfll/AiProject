import hmac

from django.conf import settings
from rest_framework.permissions import BasePermission


class HasN8nToken(BasePermission):
    """Static bearer-token check for n8n -> Django calls (US-E7-02).

    Not session/CSRF based (n8n is a machine caller, not a browser) — the
    token lives only in .env (N8N_API_TOKEN) and is sent as
    'Authorization: Bearer <token>'. Timing-safe comparison via hmac.
    """

    message = "Token n8n invalide ou manquant."

    def has_permission(self, request, view):
        expected = getattr(settings, "N8N_API_TOKEN", "")
        if not expected:
            return False
        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header.startswith("Bearer "):
            return False
        provided = header[len("Bearer "):]
        return hmac.compare_digest(provided, expected)
