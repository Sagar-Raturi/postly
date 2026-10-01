"""
What the auth endpoints do when account mail cannot be sent.

Regression guard for a production signup that answered Django's HTML
"Server Error (500)" page: Resend refused the recipient (the sending domain
was not yet verified, so it would only deliver to the account owner), the
exception escaped the view, and the User row it had already committed made
every retry fail with "an account with this address already exists".

The failure is injected at the email backend, beneath allauth and the
adapter, so everything above it runs for real. AnymailAPIError is what the
Resend backend raised in production.
"""

import logging

import pytest
from allauth.account.models import EmailAddress
from anymail.exceptions import AnymailAPIError
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.mail.backends.locmem import EmailBackend

from accounts.adapters import EmailNotSent, PostlyAccountAdapter
from accounts.views import SIGNUP_EMAIL_FAILED, VERIFICATION_SENT

pytestmark = pytest.mark.django_db

User = get_user_model()

SIGNUP_URL = "/api/auth/signup/"
RESET_URL = "/api/auth/password/reset/"
RESEND_URL = "/api/auth/resend-verification/"

SIGNUP = {
    "email": "new@example.com",
    "display_name": "New Writer",
    "password1": "quiet-desk-lamp",
    "password2": "quiet-desk-lamp",
}


@pytest.fixture
def mail_is_down(monkeypatch):
    """
    Makes every send raise until the test calls the returned function.

    Patched on the class rather than swapped in settings, because the test
    runner has already pointed EMAIL_BACKEND at locmem and that is the one
    allauth will instantiate.
    """
    original = EmailBackend.send_messages

    def refuse(self, messages):
        raise AnymailAPIError("Resend: you can only send testing emails to your own address")

    monkeypatch.setattr(EmailBackend, "send_messages", refuse)

    def restore():
        monkeypatch.setattr(EmailBackend, "send_messages", original)

    return restore


class TestSignup:
    def test_answers_503_with_a_readable_detail(self, api, mail_is_down):
        response = api.post(SIGNUP_URL, SIGNUP, format="json")

        assert response.status_code == 503
        # JSON the signup form can show as it is, not an HTML error page.
        assert response.json() == {"detail": SIGNUP_EMAIL_FAILED}

    def test_leaves_no_account_behind(self, api, mail_is_down):
        api.post(SIGNUP_URL, SIGNUP, format="json")

        assert not User.objects.filter(email__iexact=SIGNUP["email"]).exists()
        assert not EmailAddress.objects.filter(email__iexact=SIGNUP["email"]).exists()

    def test_signing_up_again_once_mail_works_succeeds_and_sends(self, api, mail_is_down):
        """
        The whole point of rolling back. Straight after the failure, too:
        allauth's three-minute confirmation cooldown was spent on the
        attempt that failed, and unless the view clears it this retry
        creates the account and silently skips the email.
        """
        assert api.post(SIGNUP_URL, SIGNUP, format="json").status_code == 503

        mail_is_down()
        retry = api.post(SIGNUP_URL, SIGNUP, format="json")

        assert retry.status_code == 201
        assert User.objects.filter(email__iexact=SIGNUP["email"]).count() == 1
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [SIGNUP["email"]]

    def test_the_provider_error_is_logged(self, api, mail_is_down, caplog):
        with caplog.at_level(logging.ERROR, logger="accounts.views"):
            api.post(SIGNUP_URL, SIGNUP, format="json")

        [record] = [r for r in caplog.records if r.name == "accounts.views"]
        # The provider's own message is the only clue to why, so it has to
        # survive as the cause rather than be replaced by ours.
        assert isinstance(record.exc_info[1], EmailNotSent)
        assert isinstance(record.exc_info[1].__cause__, AnymailAPIError)

    def test_validation_errors_are_still_400s(self, api, mail_is_down):
        """Nothing is sent for a bad form, so a mail outage cannot change its answer."""
        response = api.post(
            SIGNUP_URL, {**SIGNUP, "password2": "something-else"}, format="json"
        )
        assert response.status_code == 400


class TestPasswordReset:
    def test_answers_exactly_as_for_an_unknown_address(self, api, user_a, mail_is_down):
        known = api.post(RESET_URL, {"email": user_a.email}, format="json")
        unknown = api.post(RESET_URL, {"email": "nobody@example.com"}, format="json")

        assert known.status_code == unknown.status_code == 200
        assert known.json() == unknown.json()

    def test_the_failure_is_logged(self, api, user_a, mail_is_down, caplog):
        with caplog.at_level(logging.ERROR, logger="accounts.serializers"):
            api.post(RESET_URL, {"email": user_a.email}, format="json")

        [record] = [r for r in caplog.records if r.name == "accounts.serializers"]
        assert isinstance(record.exc_info[1].__cause__, AnymailAPIError)


class TestResendVerification:
    @pytest.fixture
    def unverified(self, make_user):
        return make_user("waiting@example.com", verified=False)

    def test_answers_exactly_as_for_an_unknown_address(
        self, api, unverified, mail_is_down
    ):
        known = api.post(RESEND_URL, {"email": unverified.email}, format="json")
        unknown = api.post(RESEND_URL, {"email": "nobody@example.com"}, format="json")

        assert known.status_code == unknown.status_code == 200
        assert known.json() == unknown.json() == {"detail": VERIFICATION_SENT}

    def test_the_failure_is_logged(self, api, unverified, mail_is_down, caplog):
        with caplog.at_level(logging.ERROR, logger="accounts.views"):
            api.post(RESEND_URL, {"email": unverified.email}, format="json")

        [record] = [r for r in caplog.records if r.name == "accounts.views"]
        assert isinstance(record.exc_info[1].__cause__, AnymailAPIError)


class TestAdapter:
    def test_a_template_error_is_an_email_failure_too(self, rf):
        """
        Rendering happens inside the same net as delivery, so a broken
        template cannot bypass the callers' handling and become a bare 500.
        """
        from allauth.core import context

        with context.request_context(rf.get("/")):
            with pytest.raises(EmailNotSent):
                PostlyAccountAdapter().send_mail(
                    "account/email/no_such_template", "someone@example.com", {}
                )


class TestLoginBeforeConfirming:
    def test_a_failed_send_still_gives_the_usual_answer(
        self, api, make_user, password, mail_is_down
    ):
        """The verify page the person lands on can try again; a 500 here
        would only hide the screen that offers it."""
        make_user("late@example.com", verified=False)

        response = api.post(
            "/api/auth/login/",
            {"email": "late@example.com", "password": password},
            format="json",
        )

        assert response.status_code == 400
        assert response.json()["code"] == "email_not_verified"
