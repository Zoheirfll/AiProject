import logging
import re


def _redact_secrets(message):
    """Best-effort scrub of known secret values and generic auth-header
    patterns before a message lands in the DB-backed TechnicalLog (readable
    by any DRH via /logs) — defends against an underlying HTTP client (e.g.
    the Groq/requests exception path) ever including a credential in an
    exception's string representation."""
    from django.conf import settings

    for attr in ("GROQ_API_KEY", "EMAIL_HOST_PASSWORD", "N8N_API_TOKEN", "SECRET_KEY"):
        value = getattr(settings, attr, "")
        if value and len(value) >= 8:
            message = message.replace(value, "[REDACTED]")

    message = re.sub(r"(Bearer\s+)[A-Za-z0-9\-_.=]+", r"\1[REDACTED]", message)
    message = re.sub(
        r'((?:api[_-]?key|authorization|password)["\']?\s*[:=]\s*["\']?)[^\s"\']+',
        r"\1[REDACTED]",
        message,
        flags=re.IGNORECASE,
    )
    return message


class DatabaseLogHandler(logging.Handler):
    """Écrit chaque enregistrement de log dans TechnicalLog.

    Import différé de models/db pour éviter les soucis d'ordre de chargement
    au démarrage de Django (LOGGING est évalué avant que les apps soient prêtes).
    """

    def emit(self, record):
        try:
            from .models import TechnicalLog

            TechnicalLog.objects.create(
                level=record.levelname if record.levelname in ("INFO", "WARNING", "ERROR") else "INFO",
                logger_name=record.name,
                message=_redact_secrets(self.format(record)),
            )
        except Exception:  # noqa: BLE001
            # Ne jamais faire planter l'appelant à cause d'un souci de logging
            # (ex: table pas encore migrée, DB indisponible).
            pass
