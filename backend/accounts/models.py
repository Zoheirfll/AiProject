from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        DRH = "DRH", "DRH"
        CHARGE_RH = "CHARGE_RH", "Chargé RH"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CHARGE_RH)
    email = models.EmailField(unique=True)

    @property
    def is_drh(self):
        return self.role == self.Role.DRH


class LoginAttempt(models.Model):
    """Tracks failed logins per (username, IP) for lockout (US: brute-force
    protection). Keyed by IP as well as username — not just username — so an
    attacker hammering a known account (e.g. the DRH account) from one
    source can't lock that account out for the legitimate user connecting
    from their own normal network/device."""

    username = models.CharField(max_length=150, db_index=True)
    ip = models.GenericIPAddressField(null=True, blank=True, db_index=True)
    echoue_le = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-echoue_le"]
