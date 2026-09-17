"""
Serializers for the auth endpoints.

Note what is *not* imported here: dj_rest_auth.registration.serializers.
Its module scope reaches into allauth's social-login providers, which drags
in `requests` and forces `allauth.socialaccount` into INSTALLED_APPS. Postly
has no social login, so SignupSerializer is written against allauth's
adapter directly — the same three calls dj-rest-auth's own version makes.
"""

from allauth.account.adapter import get_adapter
from allauth.account.forms import default_token_generator
from allauth.account.models import EmailAddress
from allauth.account.utils import setup_user_email, user_pk_to_url_str
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from . import avatars

User = get_user_model()


class SignupSerializer(serializers.Serializer):
    """
    Creates the account. The confirmation mail is sent by the view, via
    allauth's complete_signup().
    """

    email = serializers.EmailField()
    display_name = serializers.CharField(max_length=80)
    password1 = serializers.CharField(write_only=True, style={"input_type": "password"})
    password2 = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_email(self, value: str) -> str:
        email = get_adapter().clean_email(value)

        if (
            User.objects.filter(email__iexact=email).exists()
            or EmailAddress.objects.filter(email__iexact=email).exists()
        ):
            raise serializers.ValidationError(
                "An account with this address already exists."
            )
        return email

    def validate_display_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Tell us what to call you.")
        return value

    def validate_password1(self, value: str) -> str:
        return get_adapter().clean_password(value)

    def validate(self, data: dict) -> dict:
        if data["password1"] != data["password2"]:
            raise serializers.ValidationError(
                {"password2": "The two passwords do not match."}
            )
        return data

    def get_cleaned_data(self) -> dict:
        # Whatever this returns reaches the adapter as `form.cleaned_data`.
        return {
            "email": self.validated_data.get("email", ""),
            "display_name": self.validated_data.get("display_name", ""),
            "password1": self.validated_data.get("password1", ""),
        }

    def save(self, request):
        adapter = get_adapter()
        user = adapter.new_user(request)

        self.cleaned_data = self.get_cleaned_data()
        adapter.save_user(request, user, self, commit=False)

        # Validators that need the user instance (similarity to the email,
        # for one) can only run now that the fields are populated.
        try:
            adapter.clean_password(self.cleaned_data["password1"], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(serializers.as_serializer_error(exc))

        user.save()
        setup_user_email(request, user, [])
        return user


class UserSerializer(serializers.ModelSerializer):
    """Backs GET/PATCH /api/auth/user/."""

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "display_name",
            "bio",
            "avatar",
            "show_email_publicly",
            "date_joined",
        ]
        # Changing an address means re-verifying it, which is a flow of its
        # own; this endpoint only renames.
        #
        # `avatar` is read-only *here* because a file cannot travel in the
        # JSON body this endpoint takes. It is written by AvatarView, which
        # returns this same serializer so the client has one shape to read.
        # A writer with no avatar gets the initials circle, which is the
        # designed state rather than a gap.
        read_only_fields = ["id", "email", "avatar", "date_joined"]

    def validate_display_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Tell us what to call you.")
        return value

    def validate_bio(self, value: str) -> str:
        # Stored trimmed, because the public blog renders it directly and
        # trailing whitespace becomes a visible gap under the heading.
        return value.strip()


class AvatarSerializer(serializers.Serializer):
    """
    The body of POST /api/auth/user/avatar/.

    Deliberately not a ModelSerializer. DRF's ImageField would run Django's
    own `validate_image_file_extension`, which trusts the filename, and then
    store the caller's bytes verbatim. What is wanted instead is the
    re-encode in avatars.py, so the raw upload is taken as an opaque
    FileField and that module decides whether it is an image at all.
    """

    avatar = serializers.FileField(write_only=True)

    def validate_avatar(self, upload):
        return avatars.process(upload)

    def save(self, **kwargs):
        user = self.context["request"].user

        # Replacing an avatar should not leave the old file on disk
        # forever. `save=False` because assigning the new one below is what
        # writes the row.
        if user.avatar:
            user.avatar.delete(save=False)

        processed = self.validated_data["avatar"]
        user.avatar.save(processed.name, processed, save=True)
        return user


class PasswordResetSerializer(serializers.Serializer):
    """
    Sends the reset mail, replacing dj-rest-auth's default.

    Two reasons not to use the default, which delegates to Django's
    PasswordResetForm:

    1. It would not work. With allauth installed, dj-rest-auth validates the
       confirmation with *allauth's* token generator and base36 uid, while
       Django's form signs links with Django's generator and a base64 uid.
       The link it mails is one its own confirm endpoint rejects.
    2. The link has to point at the Next.js reset page, and the mail has to
       use Postly's templates.

    The response is identical whether or not the address has an account, so
    this endpoint cannot be used to find out who has signed up.
    """

    email = serializers.EmailField()

    def validate_email(self, value: str) -> str:
        return get_adapter().clean_email(value)

    def save(self) -> None:
        email = self.validated_data["email"]

        # Inactive users are skipped: a disabled account should not be
        # recoverable by whoever disabled it.
        for user in User.objects.filter(email__iexact=email, is_active=True):
            self._send(user, email)

    def _send(self, user, email: str) -> None:
        token = default_token_generator.make_token(user)
        uid = user_pk_to_url_str(user)
        url = f"{settings.FRONTEND_URL}/reset-password/{token}?uid={uid}"

        get_adapter().send_mail(
            "account/email/password_reset_key",
            email,
            {
                "user": user,
                "password_reset_url": url,
                "timeout_hours": max(1, settings.PASSWORD_RESET_TIMEOUT // 3600),
            },
        )
