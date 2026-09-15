import re

import pytest
from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.core import mail

pytestmark = pytest.mark.django_db

User = get_user_model()

SIGNUP_URL = "/api/auth/signup/"
LOGIN_URL = "/api/auth/login/"
LOGOUT_URL = "/api/auth/logout/"
USER_URL = "/api/auth/user/"
RESET_URL = "/api/auth/password/reset/"
RESET_CONFIRM_URL = "/api/auth/password/reset/confirm/"
CHANGE_URL = "/api/auth/password/change/"
RESEND_URL = "/api/auth/resend-verification/"

SIGNUP = {
    "email": "new@example.com",
    "display_name": "New Writer",
    "password1": "quiet-desk-lamp",
    "password2": "quiet-desk-lamp",
}


def verification_key() -> str:
    """Pull the confirmation key out of the link in the last email sent."""
    match = re.search(r"/verify-email\?key=([^\s\"<]+)", mail.outbox[-1].body)
    assert match, f"no confirmation link in:\n{mail.outbox[-1].body}"
    return match.group(1)


def reset_credentials() -> tuple[str, str]:
    """Pull (uid, token) out of the reset link in the last email sent."""
    match = re.search(r"/reset-password/([^?\s]+)\?uid=([^\s\"<]+)", mail.outbox[-1].body)
    assert match, f"no reset link in:\n{mail.outbox[-1].body}"
    return match.group(2), match.group(1)


class TestSignup:
    def test_creates_an_account_that_cannot_log_in_until_verified(self, api):
        response = api.post(SIGNUP_URL, SIGNUP, format="json")
        assert response.status_code == 201

        user = User.objects.get(email="new@example.com")
        assert user.display_name == "New Writer"
        # The row is active; what gates the account is the unverified
        # address, which is allauth's own notion of "not yet usable".
        assert user.is_active is True
        assert EmailAddress.objects.get(user=user).verified is False

        refused = api.post(
            LOGIN_URL,
            {"email": SIGNUP["email"], "password": SIGNUP["password1"]},
            format="json",
        )
        assert refused.status_code == 400
        assert "not verified" in str(refused.json()).lower()

    def test_sends_a_verification_email_pointing_at_the_frontend(self, api, settings):
        api.post(SIGNUP_URL, SIGNUP, format="json")

        assert len(mail.outbox) == 1
        message = mail.outbox[0]
        assert message.to == ["new@example.com"]
        assert settings.FRONTEND_URL in message.body
        # Plaintext plus an HTML alternative.
        assert message.alternatives and message.alternatives[0][1] == "text/html"

    def test_confirming_the_key_allows_login(self, api):
        api.post(SIGNUP_URL, SIGNUP, format="json")

        confirmed = api.get(f"/api/auth/verify-email/{verification_key()}/")
        assert confirmed.status_code == 200

        assert EmailAddress.objects.get(email=SIGNUP["email"]).verified is True

        response = api.post(
            LOGIN_URL,
            {"email": SIGNUP["email"], "password": SIGNUP["password1"]},
            format="json",
        )
        assert response.status_code in (200, 204)

    def test_a_second_click_on_the_same_link_says_something_useful(self, api):
        """
        allauth's HMAC keys are stateless and its lookup filters on
        verified=False, so a spent link cannot be told apart from a bad one.
        The message has to cover both, and point at the way out.
        """
        api.post(SIGNUP_URL, SIGNUP, format="json")
        key = verification_key()

        assert api.get(f"/api/auth/verify-email/{key}/").status_code == 200

        second = api.get(f"/api/auth/verify-email/{key}/")
        assert second.status_code == 400
        assert "already been used" in second.json()["detail"]
        assert "logging in" in second.json()["detail"]

    def test_a_junk_key_is_rejected(self, api):
        assert api.get("/api/auth/verify-email/not-a-real-key/").status_code == 400

    def test_password_must_be_at_least_ten_characters(self, api):
        response = api.post(
            SIGNUP_URL, {**SIGNUP, "password1": "short1", "password2": "short1"}, format="json"
        )
        assert response.status_code == 400
        assert "password1" in response.json()

    def test_mismatched_passwords_are_rejected(self, api):
        response = api.post(
            SIGNUP_URL, {**SIGNUP, "password2": "something-else"}, format="json"
        )
        assert response.status_code == 400
        assert "password2" in response.json()

    def test_a_duplicate_address_is_rejected(self, api, user_a):
        response = api.post(SIGNUP_URL, {**SIGNUP, "email": user_a.email}, format="json")
        assert response.status_code == 400
        assert "email" in response.json()

    def test_display_name_is_required(self, api):
        payload = {k: v for k, v in SIGNUP.items() if k != "display_name"}
        response = api.post(SIGNUP_URL, payload, format="json")
        assert response.status_code == 400
        assert "display_name" in response.json()


class TestLoginLogout:
    def test_login_sets_a_session_cookie(self, api, user_a, password):
        response = api.post(
            LOGIN_URL, {"email": user_a.email, "password": password}, format="json"
        )
        assert response.status_code in (200, 204)

        cookie = api.cookies.get("sessionid")
        assert cookie is not None and cookie.value
        # The whole point of the cookie strategy: unreadable from JavaScript.
        assert cookie["httponly"]
        assert cookie["samesite"] == "Lax"

        assert api.get(USER_URL).status_code == 200

    def test_login_returns_no_token(self, api, user_a, password):
        """Nothing for a script to steal — the session cookie is the credential."""
        response = api.post(
            LOGIN_URL, {"email": user_a.email, "password": password}, format="json"
        )
        body = response.json() if response.content else {}
        assert "key" not in body and "access" not in body and "token" not in body

    def test_logout_clears_the_session(self, api, user_a, password):
        api.post(LOGIN_URL, {"email": user_a.email, "password": password}, format="json")
        assert api.get(USER_URL).status_code == 200

        assert api.post(LOGOUT_URL).status_code == 200

        assert not api.cookies.get("sessionid").value
        assert api.get(USER_URL).status_code == 401

    def test_logout_is_not_allowed_on_get(self, api_a):
        assert api_a.get(LOGOUT_URL).status_code == 405

    def test_bad_credentials_are_a_400(self, api, user_a):
        response = api.post(
            LOGIN_URL, {"email": user_a.email, "password": "wrong-password"}, format="json"
        )
        assert response.status_code == 400

    def test_user_endpoint_is_401_when_anonymous(self, api):
        response = api.get(USER_URL)
        assert response.status_code == 401
        # A 403 would say "logged in, but not allowed"; the frontend needs to
        # be able to tell the difference.
        assert "WWW-Authenticate" in response.headers

    def test_user_endpoint_returns_the_account(self, api_a, user_a):
        body = api_a.get(USER_URL).json()
        assert body["email"] == user_a.email
        assert body["display_name"] == "Ada Wren"

    def test_display_name_can_be_changed(self, api_a, user_a):
        response = api_a.patch(USER_URL, {"display_name": "Ada W."}, format="json")
        assert response.status_code == 200
        user_a.refresh_from_db()
        assert user_a.display_name == "Ada W."

    def test_email_cannot_be_changed_here(self, api_a, user_a):
        api_a.patch(USER_URL, {"email": "hijack@example.com"}, format="json")
        user_a.refresh_from_db()
        assert user_a.email == "ada@example.com"


class TestThrottling:
    def test_login_throttles_after_five_attempts(self, api, user_a):
        attempt = {"email": user_a.email, "password": "wrong-password"}

        for _ in range(5):
            assert api.post(LOGIN_URL, attempt, format="json").status_code == 400

        assert api.post(LOGIN_URL, attempt, format="json").status_code == 429

    def test_throttling_also_blocks_the_correct_password(self, api, user_a, password):
        """Otherwise the limit would only slow down the guesses that miss."""
        for _ in range(5):
            api.post(LOGIN_URL, {"email": user_a.email, "password": "wrong"}, format="json")

        blocked = api.post(
            LOGIN_URL, {"email": user_a.email, "password": password}, format="json"
        )
        assert blocked.status_code == 429

    def test_password_reset_is_throttled(self, api, user_a):
        for _ in range(5):
            assert api.post(RESET_URL, {"email": user_a.email}, format="json").status_code == 200

        assert api.post(RESET_URL, {"email": user_a.email}, format="json").status_code == 429


class TestPasswordReset:
    def test_an_unknown_address_looks_exactly_like_a_known_one(self, api, user_a):
        known = api.post(RESET_URL, {"email": user_a.email}, format="json")
        sent_for_known = len(mail.outbox)

        unknown = api.post(RESET_URL, {"email": "nobody@example.com"}, format="json")

        assert known.status_code == unknown.status_code == 200
        assert known.json() == unknown.json()
        # ...and the only difference, the mail itself, is not visible to the
        # caller.
        assert sent_for_known == 1
        assert len(mail.outbox) == 1

    def test_the_emailed_link_is_accepted_by_the_confirm_endpoint(
        self, api, user_a
    ):
        """
        Regression guard. dj-rest-auth validates the confirmation with
        allauth's token generator and base36 uid; Django's PasswordResetForm
        signs links with its own generator and a base64 uid. Wiring the
        default serializer would mail a link this endpoint always rejects.
        """
        api.post(RESET_URL, {"email": user_a.email}, format="json")
        uid, token = reset_credentials()

        response = api.post(
            RESET_CONFIRM_URL,
            {
                "uid": uid,
                "token": token,
                "new_password1": "a-brand-new-passphrase",
                "new_password2": "a-brand-new-passphrase",
            },
            format="json",
        )
        assert response.status_code == 200

        user_a.refresh_from_db()
        assert user_a.check_password("a-brand-new-passphrase")

    def test_the_new_password_works_for_login(self, api, user_a):
        api.post(RESET_URL, {"email": user_a.email}, format="json")
        uid, token = reset_credentials()
        api.post(
            RESET_CONFIRM_URL,
            {
                "uid": uid,
                "token": token,
                "new_password1": "a-brand-new-passphrase",
                "new_password2": "a-brand-new-passphrase",
            },
            format="json",
        )

        response = api.post(
            LOGIN_URL,
            {"email": user_a.email, "password": "a-brand-new-passphrase"},
            format="json",
        )
        assert response.status_code in (200, 204)

    def test_a_tampered_token_is_rejected(self, api, user_a):
        api.post(RESET_URL, {"email": user_a.email}, format="json")
        uid, _ = reset_credentials()

        response = api.post(
            RESET_CONFIRM_URL,
            {
                "uid": uid,
                "token": "made-up-token",
                "new_password1": "a-brand-new-passphrase",
                "new_password2": "a-brand-new-passphrase",
            },
            format="json",
        )
        assert response.status_code == 400

    def test_a_short_new_password_is_rejected(self, api, user_a):
        api.post(RESET_URL, {"email": user_a.email}, format="json")
        uid, token = reset_credentials()

        response = api.post(
            RESET_CONFIRM_URL,
            {"uid": uid, "token": token, "new_password1": "short1", "new_password2": "short1"},
            format="json",
        )
        assert response.status_code == 400

    def test_reset_tokens_expire_after_an_hour(self, settings):
        assert settings.PASSWORD_RESET_TIMEOUT == 3600


class TestPasswordChange:
    def test_changing_the_password(self, api_a, user_a, password):
        response = api_a.post(
            CHANGE_URL,
            {
                "old_password": password,
                "new_password1": "a-brand-new-passphrase",
                "new_password2": "a-brand-new-passphrase",
            },
            format="json",
        )
        assert response.status_code == 200

        user_a.refresh_from_db()
        assert user_a.check_password("a-brand-new-passphrase")

    def test_the_old_password_is_required(self, api_a):
        response = api_a.post(
            CHANGE_URL,
            {
                "old_password": "not-the-old-one",
                "new_password1": "a-brand-new-passphrase",
                "new_password2": "a-brand-new-passphrase",
            },
            format="json",
        )
        assert response.status_code == 400

    def test_anonymous_callers_get_401(self, api):
        assert api.post(CHANGE_URL, {}, format="json").status_code == 401


class TestResendVerification:
    def test_resending_to_an_unverified_address(self, api):
        api.post(SIGNUP_URL, SIGNUP, format="json")
        mail.outbox.clear()

        response = api.post(RESEND_URL, {"email": SIGNUP["email"]}, format="json")
        assert response.status_code == 200
        assert len(mail.outbox) == 1

    def test_an_unknown_address_looks_the_same_and_sends_nothing(self, api):
        response = api.post(RESEND_URL, {"email": "nobody@example.com"}, format="json")
        assert response.status_code == 200
        assert mail.outbox == []


class TestAuthHintCookie:
    """
    The cookie the Next.js middleware routes on.

    Regression guard for an infinite redirect loop: the middleware used to
    read `sessionid`, but Django gives anonymous visitors one too, so a
    signed-out person was bounced from /login to /dashboard, 401'd, sent
    back to /login, and round again.
    """

    HINT = "postly_auth"

    def test_signing_up_does_not_look_like_being_signed_in(self, api):
        api.post(SIGNUP_URL, SIGNUP, format="json")

        # allauth writes to the session during signup, so this exists...
        assert api.cookies.get("sessionid") is not None
        # ...but nobody is logged in, and the hint has to say so.
        assert not (api.cookies.get(self.HINT) and api.cookies[self.HINT].value)

    def test_login_sets_the_hint(self, api, user_a, password):
        api.post(LOGIN_URL, {"email": user_a.email, "password": password}, format="json")

        cookie = api.cookies.get(self.HINT)
        assert cookie is not None and cookie.value == "1"
        # Readable by the Next.js middleware, which is the entire point.
        assert not cookie["httponly"]

    def test_logout_clears_the_hint(self, api, user_a, password):
        api.post(LOGIN_URL, {"email": user_a.email, "password": password}, format="json")
        api.post(LOGOUT_URL)

        assert not api.cookies[self.HINT].value

    def test_an_expired_session_clears_the_hint_on_the_next_request(
        self, api, user_a, password
    ):
        """
        The frontend's own "who am I" call is what does the cleaning up: it
        401s, and the response takes the stale hint with it.
        """
        api.post(LOGIN_URL, {"email": user_a.email, "password": password}, format="json")
        assert api.cookies[self.HINT].value == "1"

        # Whatever ended the session server-side, the cookie outlives it.
        api.cookies.pop("sessionid")

        assert api.get(USER_URL).status_code == 401
        assert not api.cookies[self.HINT].value

    def test_the_hint_alone_opens_nothing(self, api):
        """It is a routing hint, never a credential."""
        api.cookies[self.HINT] = "1"

        assert api.get("/api/posts/").status_code == 401
        assert api.get(USER_URL).status_code == 401


class TestCsrf:
    def test_the_csrf_endpoint_sets_a_readable_cookie(self, api):
        response = api.get("/api/auth/csrf/")
        assert response.status_code == 200

        cookie = api.cookies.get("csrftoken")
        assert cookie is not None and cookie.value
        # Readable by JavaScript on purpose: lib/api.ts copies it into the
        # X-CSRFToken header. The session cookie is the credential, and that
        # one is httpOnly.
        assert not cookie["httponly"]

    def test_an_unsafe_request_without_the_token_is_refused(self, user_a, password):
        from rest_framework.test import APIClient

        # enforce_csrf_checks mirrors what a browser actually faces; the
        # other tests leave it off so they can exercise the endpoints.
        client = APIClient(enforce_csrf_checks=True)
        client.post(LOGIN_URL, {"email": user_a.email, "password": password}, format="json")

        response = client.post(
            "/api/sites/", {"name": "No Token", "slug": "no-token"}, format="json"
        )
        assert response.status_code == 403
