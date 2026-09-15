"""
Fixtures shared by both test packages.

Lives at the project root so `accounts/tests` and `blog/tests` see the same
users and the same throttle hygiene.
"""

import pytest
from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIClient

User = get_user_model()

# Long enough for MinimumLengthValidator(10), not in the common-password
# list, and not all digits.
PASSWORD = "quiet-desk-lamp"


@pytest.fixture(autouse=True)
def clear_throttle_state():
    """
    Throttle counters live in the cache, which outlives a test.

    Without this, one test spending the login budget makes the next test's
    login 429, and the failure lands nowhere near the cause.
    """
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def password() -> str:
    return PASSWORD


@pytest.fixture
def make_user(db):
    def factory(email, display_name="A Writer", *, verified=True, password=PASSWORD):
        user = User.objects.create_user(
            email=email, password=password, display_name=display_name
        )
        EmailAddress.objects.create(
            user=user, email=email, verified=verified, primary=True
        )
        return user

    return factory


@pytest.fixture
def user_a(make_user):
    return make_user("ada@example.com", "Ada Wren")


@pytest.fixture
def user_b(make_user):
    return make_user("bo@example.com", "Bo Vale")


@pytest.fixture
def api() -> APIClient:
    """Anonymous client."""
    return APIClient()


@pytest.fixture
def api_a(user_a) -> APIClient:
    client = APIClient()
    client.force_login(user_a)
    return client


@pytest.fixture
def api_b(user_b) -> APIClient:
    client = APIClient()
    client.force_login(user_b)
    return client
