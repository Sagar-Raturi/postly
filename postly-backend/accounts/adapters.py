from urllib.parse import quote

from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.utils import user_field
from django.conf import settings


class PostlyAccountAdapter(DefaultAccountAdapter):
    """
    Teaches allauth two Postly-specific things.

    1. Accounts carry a `display_name`, which the signup serializer collects
       and which allauth's own save_user() knows nothing about.
    2. Confirmation links have to land on the Next.js frontend, not on a
       Django page — this backend renders no HTML for people.
    """

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
