from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from accounts.models import User


class Command(BaseCommand):
    help = "Create (or update the role of) an HR user for GRH-Auto."

    def add_arguments(self, parser):
        parser.add_argument("username")
        parser.add_argument("email")
        parser.add_argument("--password", required=True)
        parser.add_argument("--role", choices=[User.Role.DRH, User.Role.CHARGE_RH], default=User.Role.CHARGE_RH)

    def handle(self, *args, **options):
        Model = get_user_model()
        username = options["username"]

        user, created = Model.objects.get_or_create(
            username=username, defaults={"email": options["email"], "role": options["role"]}
        )
        if not created:
            user.email = options["email"]
            user.role = options["role"]

        user.set_password(options["password"])
        user.save()

        if created:
            self.stdout.write(self.style.SUCCESS(f"Utilisateur '{username}' créé avec le rôle {options['role']}."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Utilisateur '{username}' mis à jour (mot de passe/rôle)."))
