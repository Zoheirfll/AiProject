from django.conf import settings
from django.db import migrations


def seed_default_token(apps, schema_editor):
    """Preserve the already-configured n8n 'GRH-Auto API Token' Header Auth
    credential: seed a full-scope N8nApiToken row with the exact value that
    used to be the single global settings.N8N_API_TOKEN, so switching to
    scoped tokens doesn't break existing workflows."""
    N8nApiToken = apps.get_model("n8n_integration", "N8nApiToken")
    existing = getattr(settings, "N8N_API_TOKEN", "")
    if not existing:
        return
    N8nApiToken.objects.get_or_create(
        token=existing,
        defaults={
            "nom": "Token par défaut (migration E7)",
            "scopes": ["employes:read", "contrats:read", "mails:send", "logs:write"],
            "actif": True,
        },
    )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("n8n_integration", "0002_n8napitoken_n8napilog_token"),
    ]

    operations = [
        migrations.RunPython(seed_default_token, noop_reverse),
    ]
