"""
The custom user model.

Postly identifies people by email address: there is no username field, and
`USERNAME_FIELD` is `email`. Swapping this in later would have meant rewriting
history, so it exists from the first migration — see MIGRATION.md.
"""

import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


def avatar_path(instance, filename: str) -> str:
    """
    Where an uploaded avatar lands.

    The name the browser sent is thrown away rather than slugified. It is
    attacker-controlled, it is sometimes revealing ("passport-photo.jpg"),
    and it is never useful — the file is re-encoded on the way in, so the
    only part worth keeping is the extension the re-encoder chose.
    """
    suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    return f"avatars/{uuid.uuid4().hex}.{suffix}"


class UserManager(BaseUserManager):
    """
    Manager for a user model with no username.

    Django's own UserManager insists on a username argument, so the two
    creation entry points are reimplemented around email instead.
    """

    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("A user needs an email address.")

        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)

        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        # set_password(None) marks the password unusable, which is what we
        # want for an account that will only ever log in via a reset link.
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        # Set rather than defaulted, so `createsuperuser --is-staff false`
        # cannot quietly produce an admin who cannot reach the admin.
        if extra_fields["is_staff"] is not True:
            raise ValueError("A superuser must have is_staff=True.")
        if extra_fields["is_superuser"] is not True:
            raise ValueError("A superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(
        unique=True,
        db_index=True,
        help_text="Used to sign in, and the address verification mail is sent to.",
    )
    display_name = models.CharField(
        max_length=80,
        help_text="Shown as the author on published posts.",
    )

    # --- The public profile -------------------------------------------------
    # These three are the profile panel on a published blog. They describe
    # the writer to a stranger, so each one is either opt-in or harmless:
    # `bio` is prose the writer chose to publish, `avatar` is a picture they
    # uploaded, and the address behind `show_email_publicly` stays on the
    # server until they turn it on. See blog/public_serializers.py.
    bio = models.TextField(
        blank=True,
        max_length=300,
        help_text="A short 'About' note, shown beside the posts on the "
        "public blog. Around 300 characters — it is a paragraph, not a page.",
    )
    avatar = models.ImageField(
        # A callable, not "avatars/": the browser's filename is discarded
        # rather than stored. See avatar_path above, and accounts/avatars.py
        # for the re-encoding the file goes through before it gets here.
        upload_to=avatar_path,
        null=True,
        blank=True,
        help_text="Optional. The blog falls back to an initials circle in "
        "the theme's accent when this is empty.",
    )
    show_email_publicly = models.BooleanField(
        default=False,
        help_text="Whether the public blog shows this address. Off by "
        "default: publishing an address is a decision, not a side effect of "
        "having one.",
    )

    is_active = models.BooleanField(
        default=True,
        help_text="Unselect instead of deleting an account, so their posts survive.",
    )
    is_staff = models.BooleanField(
        default=False,
        help_text="Whether this user can sign in to the Django admin.",
    )
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    # Prompted for by createsuperuser, on top of USERNAME_FIELD and password.
    REQUIRED_FIELDS = ["display_name"]

    class Meta:
        ordering = ["email"]

    def __str__(self) -> str:
        return self.display_name or self.email

    @property
    def short_name(self) -> str:
        """First word of the display name, for greetings in the UI."""
        return (self.display_name or self.email).split()[0]

    def get_full_name(self) -> str:
        return self.display_name

    def get_short_name(self) -> str:
        return self.short_name
