"""
Prints a confirmation or password-reset link for an account.

Development convenience. The console email backend writes links to whatever
terminal is running `runserver`, which is no help when that output is not in
front of you — a server started in the background, in another window, or with
its stdout buffered. Resending the mail does not help either: it lands in the
same place. This prints the link where you are.
"""

from allauth.account.forms import default_token_generator
from allauth.account.models import EmailAddress, EmailConfirmationHMAC
from allauth.account.utils import user_pk_to_url_str
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()


class Command(BaseCommand):
    help = "Print an email-confirmation (or --reset password) link for an account."

    def add_arguments(self, parser):
        parser.add_argument("email", nargs="?", help="Omit to list unverified accounts.")
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Print a password-reset link instead of a confirmation link.",
        )

    def handle(self, *args, **options):
        if not options["email"]:
            return self.list_unverified()

        email = options["email"]
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            raise CommandError(f"No account with the address {email}.")

        if options["reset"]:
            token = default_token_generator.make_token(user)
            uid = user_pk_to_url_str(user)
            self.stdout.write(
                f"{settings.FRONTEND_URL}/reset-password/{token}?uid={uid}"
            )
            self.stdout.write(self.style.WARNING("Expires in one hour."))
            return

        address = EmailAddress.objects.filter(user=user, email__iexact=email).first()
        if address is None:
            raise CommandError(f"{email} has no EmailAddress row to confirm.")

        if address.verified:
            self.stdout.write(
                self.style.SUCCESS(f"{email} is already verified — just log in.")
            )
            return

        from urllib.parse import quote

        key = quote(EmailConfirmationHMAC(address).key)
        self.stdout.write(f"{settings.FRONTEND_URL}/verify-email?key={key}")

    def list_unverified(self):
        pending = EmailAddress.objects.filter(verified=False).select_related("user")

        if not pending:
            self.stdout.write("Every account is verified.")
            return

        self.stdout.write("Waiting on confirmation:")
        for address in pending:
            self.stdout.write(f"  {address.email}")
        self.stdout.write(
            "\nRun this again with one of those addresses to get its link."
        )
