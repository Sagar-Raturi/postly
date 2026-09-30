from urllib.parse import quote

from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.utils import user_field
from django.conf import settings


class EmailNotSent(Exception):
    """
    Account mail could not be sent. The original error is its __cause__.

    Raised by PostlyAccountAdapter.send_mail() in place of whatever the
    transport threw, which is different for every transport: anymail raises
    AnymailAPIError when Resend refuses a recipient (which, until the
    sending domain is verified, is every recipient but the account owner),
    SMTP raises smtplib.SMTPException or a bare OSError, and a broken
    template raises before anything is sent at all.

    One type is what lets each caller decide what a failed send means for
    it without wrapping `except Exception` around code that also writes to
    the database, where it would quietly turn an IntegrityError into "we
    could not send your email". The callers, and why they differ:

    * SignupView rolls the new account back and answers 503. See its
      docstring.
    * PasswordResetSerializer and ResendVerificationView log it and answer
      exactly as if it had worked, because both promise the same response
      whether or not the address has an account.
    """


class PostlyAccountAdapter(DefaultAccountAdapter):
    """
    Teaches allauth three Postly-specific things.

    1. Accounts carry a `display_name`, which the signup serializer collects
       and which allauth's own save_user() knows nothing about.
    2. Confirmation links have to land on the Next.js frontend, not on a
       Django page — this backend renders no HTML for people.
    3. A failed send surfaces as EmailNotSent, not as whatever the
       transport raised.
    """

    def send_mail(self, template_prefix: str, email: str, context: dict) -> None:
        """
        Every account email, verification and password reset alike, passes
        through here, so this is the one place a send failure is caught.

        Broad on purpose, for the reason blog/emails.py gives about its own
        send: rendering and delivery have to fail the same way, or a
        template error would slip past every caller's handling and become a
        bare 500. Nothing in here touches the database, so the net cannot
        catch anything that is not about the email.
        """
        try:
            super().send_mail(template_prefix, email, context)
        except Exception as exc:
            raise EmailNotSent(f"Could not send {template_prefix}") from exc

    def save_user(self, request, user, form, commit=True):
        data = getattr(form, "cleaned_data", {}) or {}

        # commit=False regardless of the caller: the display name has to be
        # on the instance before the row is written, or it is saved blank.
        user = super().save_user(request, user, form, commit=False)

        display_name = (data.get("display_name") or "").strip()
        user_field(user, "display_name", display_name or self.default_display_name(user))

        if commit:
            user.save()
        return user

    @staticmethod
    def default_display_name(user) -> str:
        """
        Fallback for a signup that somehow arrived without a display name.

        The local part of the address is a poor name but a much better
        byline than an empty string.
        """
        email = getattr(user, "email", "") or ""
        return email.split("@")[0][:80] or "Writer"

    def get_email_confirmation_url(self, request, emailconfirmation) -> str:
        # quote() because the HMAC key is base64-ish and can contain
        # characters that would otherwise end the query string early.
        return f"{settings.FRONTEND_URL}/verify-email?key={quote(emailconfirmation.key)}"
