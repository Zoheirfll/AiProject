from rest_framework.permissions import BasePermission


class IsDRH(BasePermission):
    """Restricts write access to DRH-role users — used on configuration and
    delete endpoints that a Chargé RH shouldn't be able to touch."""

    message = "Réservé au rôle DRH."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_drh)
