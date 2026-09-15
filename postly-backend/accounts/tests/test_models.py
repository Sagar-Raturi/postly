import pytest
from django.contrib.auth import get_user_model

pytestmark = pytest.mark.django_db

User = get_user_model()


class TestUserManager:
    def test_create_user(self):
        user = User.objects.create_user(
            email="ada@example.com", password="quiet-desk-lamp", display_name="Ada"
        )
        assert user.pk is not None
        assert user.is_active is True
        assert user.is_staff is False
        assert user.is_superuser is False
        assert user.check_password("quiet-desk-lamp")

    def test_password_is_hashed_with_argon2(self):
        user = User.objects.create_user(
            email="ada@example.com", password="quiet-desk-lamp", display_name="Ada"
        )
        assert user.password.startswith("argon2$")

    def test_email_domain_is_normalized(self):
        """BaseUserManager lowercases the domain but leaves the local part."""
        user = User.objects.create_user(
            email="Ada@EXAMPLE.COM", password="quiet-desk-lamp", display_name="Ada"
        )
        assert user.email == "Ada@example.com"

    def test_email_is_required(self):
        with pytest.raises(ValueError):
            User.objects.create_user(email="", password="quiet-desk-lamp")

    def test_create_superuser(self):
        user = User.objects.create_superuser(
            email="root@example.com", password="quiet-desk-lamp", display_name="Root"
        )
        assert user.is_staff is True
        assert user.is_superuser is True

    def test_create_superuser_refuses_a_non_staff_flag(self):
        with pytest.raises(ValueError):
            User.objects.create_superuser(
                email="root@example.com",
                password="quiet-desk-lamp",
                display_name="Root",
                is_staff=False,
            )


class TestUserModel:
    def test_email_is_the_login_identifier(self):
        assert User.USERNAME_FIELD == "email"
        assert not hasattr(User, "username")

    def test_email_is_unique(self, make_user):
        from django.db import IntegrityError

        make_user("ada@example.com")
        with pytest.raises(IntegrityError):
            User.objects.create_user(email="ada@example.com", display_name="Impostor")

    def test_str_prefers_the_display_name(self, make_user):
        assert str(make_user("ada@example.com", "Ada Wren")) == "Ada Wren"

    def test_short_name_is_the_first_word(self, make_user):
        assert make_user("ada@example.com", "Ada Wren").short_name == "Ada"
