"""
The custom user model.

Postly identifies people by email address: there is no username field, and
`USERNAME_FIELD` is `email`. Swapping this in later would have meant rewriting
history, so it exists from the first migration — see MIGRATION.md.
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


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
