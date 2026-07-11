import hmac

from django.utils import timezone
from rest_framework.permissions import BasePermission


class HasN8nScope(BasePermission):
    """DB-backed, scoped bearer-token check — replaces a single global
    static token so a token minted for one workflow (e.g. 'rapport
    quotidien') can be limited to just the scopes it needs and revoked
    independently of every other workflow's token.

    Each view declares `required_scope = N8nApiToken.Scope.XXX` (or None
    to allow any valid, active token). On success, the matched
    N8nApiToken is attached to the request as `request.n8n_token` so
    N8nBaseView.finalize_response() can log which token was used and
    bump its `derniere_utilisation`.
    """

    message = "Token n8n invalide, révoqué, ou scope insuffisant."

    def has_permission(self, request, view):
        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header.startswith("Bearer "):
            return False
        provided = header[len("Bearer "):]
        if not provided:
            return False

        from .models import N8nApiToken

        required_scope = getattr(view, "required_scope", None)

        for candidate in N8nApiToken.objects.filter(actif=True):
            if hmac.compare_digest(provided, candidate.token):
                if required_scope and required_scope not in candidate.scopes:
                    return False
                request.n8n_token = candidate
                candidate.derniere_utilisation = timezone.now()
                candidate.save(update_fields=["derniere_utilisation"])
                return True
        return False
