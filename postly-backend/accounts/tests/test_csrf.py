"""
CSRF on the endpoints a visitor uses before they have a session.

The rest of the suite runs with Django's test client default, which skips
CSRF entirely — that is what lets it post JSON without fetching a token
first. Every client here is built with `enforce_csrf_checks=True` instead,
so these tests see what a browser sees.

Why a separate file: DRF wraps every APIView in `csrf_exempt` and only
re-applies the check inside SessionAuthentication, which runs it only once
the session resolves to a signed-in user. For login, signup and the reset
flows nobody is signed in yet, so without accounts/csrf.py those endpoints
took cross-site POSTs as readily as same-site ones. The cases below pin
the fix in place for each of them, and pin the things the fix must not
disturb: 401 for anonymous callers of private endpoints, and the existing
check for signed-in ones.
"""

import pytest
from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.core import mail
from rest_framework.test import APIClient

from .test_auth import (
    CHANGE_URL,
    LOGIN_URL,
    LOGOUT_URL,
    RESEND_URL,
    RESET_CONFIRM_URL,
    RESET_URL,
    SIGNUP,
    SIGNUP_URL,
    USER_URL,
    reset_credentials,
    verification_key,
)

pytestmark = pytest.mark.django_db

User = get_user_model()

CSRF_URL = "/api/auth/csrf/"
NEW_PASSWORD = "brand-new-desk-lamp"


@pytest.fixture
def browser() -> APIClient:
    """An anonymous client that is held to CSRF, the way a browser is."""
    return APIClient(enforce_csrf_checks=True)


def fetch_token(client: APIClient) -> str:
    """Do what AuthProvider does on mount: ask for the cookie, then read it."""
    response = client.get(CSRF_URL)
    assert response.status_code == 200
    return client.cookies["csrftoken"].value


def assert_csrf_rejection(response) -> None:
    assert response.status_code == 403, response.content
    assert response.json()["detail"].startswith("CSRF Failed")


@pytest.fixture
def reset_link(api, user_a) -> dict:
    """
    A genuine uid/token pair, requested through the non-enforcing client so
    that only the confirm step is under test.
    """
    api.post(RESET_URL, {"email": user_a.email}, format="json")
    uid, token = reset_credentials()
    mail.outbox.clear()
    return {
        "uid": uid,
        "token": token,
        "new_password1": NEW_PASSWORD,
        "new_password2": NEW_PASSWORD,
    }


@pytest.fixture
def unverified(make_user):
    return make_user("pending@example.com", verified=False)


class TestAnonymousPostsWithoutAToken:
    """Each of these used to go through. Each one must now be a 403."""

    def test_login(self, browser, user_a, password):
        response = browser.post(
            LOGIN_URL, {"email": user_a.email, "password": password}, format="json"
        )

        assert_csrf_rejection(response)
        assert "sessionid" not in browser.cookies

    def test_login_with_wrong_credentials(self, browser, user_a):
        """
        The production probe: a wrong password answered 400 whatever the
        origin, which showed the credentials were checked before (or
        without) any CSRF check. The rejection has to come first.
        """
        response = browser.post(
            LOGIN_URL, {"email": user_a.email, "password": "wrong"}, format="json"
        )

        assert_csrf_rejection(response)

    def test_signup(self, browser):
        response = browser.post(SIGNUP_URL, SIGNUP, format="json")

        assert_csrf_rejection(response)
        assert not User.objects.filter(email=SIGNUP["email"]).exists()
        assert mail.outbox == []

    def test_password_reset_request(self, browser, user_a):
        response = browser.post(RESET_URL, {"email": user_a.email}, format="json")

        assert_csrf_rejection(response)
        assert mail.outbox == []

    def test_password_reset_confirm(self, browser, user_a, password, reset_link):
        response = browser.post(RESET_CONFIRM_URL, reset_link, format="json")

        assert_csrf_rejection(response)
        user_a.refresh_from_db()
        assert user_a.check_password(password)

    def test_resend_verification(self, browser, unverified):
        response = browser.post(RESEND_URL, {"email": unverified.email}, format="json")

        assert_csrf_rejection(response)
        assert mail.outbox == []

    def test_a_token_header_without_the_cookie_is_not_enough(self, browser, user_a, password):
        """The double-submit check needs both halves; a header alone proves nothing."""
        response = browser.post(
            LOGIN_URL,
            {"email": user_a.email, "password": password},
            format="json",
            HTTP_X_CSRFTOKEN="a" * 32,
        )

        assert_csrf_rejection(response)


class TestCrossSiteOrigin:
    def test_a_foreign_origin_is_refused_even_with_a_valid_token(
        self, browser, user_a, password
    ):
        """
        What an attacker's page cannot fake is the Origin header the browser
        stamps on its request. Django checks it against the request's own
        host and CSRF_TRUSTED_ORIGINS before it looks at the token.
        """
        token = fetch_token(browser)

        response = browser.post(
            LOGIN_URL,
            {"email": user_a.email, "password": password},
            format="json",
            HTTP_X_CSRFTOKEN=token,
            HTTP_ORIGIN="https://evil.example",
        )

        assert_csrf_rejection(response)
        assert "sessionid" not in browser.cookies

    def test_the_sites_own_origin_is_accepted(self, browser, user_a, password):
        token = fetch_token(browser)

        response = browser.post(
            LOGIN_URL,
            {"email": user_a.email, "password": password},
            format="json",
            HTTP_X_CSRFTOKEN=token,
            HTTP_ORIGIN="http://testserver",
        )

        assert response.status_code in (200, 204)


class TestTheFrontendsFlowStillWorks:
    """
    What lib/api.ts does: GET /api/auth/csrf/ first, then send the cookie
    back with its value copied into X-CSRFToken on every unsafe request.
    """

    def test_login(self, browser, user_a, password):
        token = fetch_token(browser)

        response = browser.post(
            LOGIN_URL,
            {"email": user_a.email, "password": password},
            format="json",
            HTTP_X_CSRFTOKEN=token,
        )

        assert response.status_code in (200, 204)
        assert browser.get(USER_URL).json()["email"] == user_a.email

    def test_wrong_credentials_are_still_a_400(self, browser, user_a):
        token = fetch_token(browser)

        response = browser.post(
            LOGIN_URL,
            {"email": user_a.email, "password": "wrong"},
            format="json",
            HTTP_X_CSRFTOKEN=token,
        )

        assert response.status_code == 400

    def test_login_rotates_the_token_and_the_new_one_works(self, browser, user_a, password):
        """
        django.contrib.auth.login() rotates the CSRF secret. lib/api.ts
        re-reads the cookie on every request, so the next unsafe call — here
        logout — has to succeed with the rotated value.
        """
        token = fetch_token(browser)
        browser.post(
            LOGIN_URL,
            {"email": user_a.email, "password": password},
            format="json",
            HTTP_X_CSRFTOKEN=token,
        )
        rotated = browser.cookies["csrftoken"].value

        response = browser.post(LOGOUT_URL, HTTP_X_CSRFTOKEN=rotated)

        assert response.status_code == 200

    def test_signup(self, browser):
        token = fetch_token(browser)

        response = browser.post(SIGNUP_URL, SIGNUP, format="json", HTTP_X_CSRFTOKEN=token)

        assert response.status_code == 201
        assert User.objects.filter(email=SIGNUP["email"]).exists()

    def test_password_reset_request(self, browser, user_a):
        token = fetch_token(browser)

        response = browser.post(
            RESET_URL, {"email": user_a.email}, format="json", HTTP_X_CSRFTOKEN=token
        )

        assert response.status_code == 200
        assert len(mail.outbox) == 1

    def test_password_reset_confirm(self, browser, user_a, reset_link):
        token = fetch_token(browser)

        response = browser.post(
            RESET_CONFIRM_URL, reset_link, format="json", HTTP_X_CSRFTOKEN=token
        )

        assert response.status_code == 200
        user_a.refresh_from_db()
        assert user_a.check_password(NEW_PASSWORD)

    def test_resend_verification(self, browser, unverified):
        token = fetch_token(browser)

        response = browser.post(
            RESEND_URL, {"email": unverified.email}, format="json", HTTP_X_CSRFTOKEN=token
        )

        assert response.status_code == 200
        assert len(mail.outbox) == 1

    def test_verify_email_is_a_get_and_needs_no_token(self, browser):
        """
        The link in the email is followed by the verify page, which calls
        this with GET — a safe method, so CSRF does not apply. The key in
        the path is the secret that stops it being forged.
        """
        APIClient().post(SIGNUP_URL, SIGNUP, format="json")

        response = browser.get(f"/api/auth/verify-email/{verification_key()}/")

        assert response.status_code == 200
        assert EmailAddress.objects.get(email=SIGNUP["email"]).verified


class TestWhatMustNotChange:
    def test_anonymous_reads_of_private_endpoints_are_still_401(self, browser):
        assert browser.get(USER_URL).status_code == 401

    def test_anonymous_posts_to_private_endpoints_are_still_401(self, browser):
        """
        Only the views that are meant to be used signed-out gained the
        check. A private endpoint still answers "log in" before anything
        else, so the frontend's 401 handler keeps working.
        """
        response = browser.post(
            CHANGE_URL,
            {"new_password1": NEW_PASSWORD, "new_password2": NEW_PASSWORD},
            format="json",
        )

        assert response.status_code == 401

    def test_signed_in_posts_without_a_token_are_still_refused(self, user_a):
        client = APIClient(enforce_csrf_checks=True)
        client.force_login(user_a)

        assert_csrf_rejection(client.post(LOGOUT_URL))
