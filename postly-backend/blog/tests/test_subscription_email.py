"""
The confirmation email: when it is sent, when it is not, and what is in it.

Django's test runner swaps in the locmem backend, so `mail.outbox` is the
whole of "did a message go out". The properties defended here are the ones
that make double opt-in worth having rather than merely present:

* a confirmed subscriber is never re-mailed by somebody typing their
  address into the form;
* one address cannot be flooded by repeated submissions;
* a send failure does not change what the API answers, because that answer
  is what keeps the form from being an address-enumeration oracle;
* the link in the message works, points at the blog, and expires.
"""

import re
from datetime import timedelta
from urllib.parse import unquote

import pytest
from django.core import mail
from django.urls import reverse
from django.utils import timezone

from blog.emails import (
    RESEND_INTERVAL,
    confirmation_url,
    from_address,
    send_subscription_confirmation,
)
from blog.models import Subscriber
from blog.public_views import SUBSCRIBE_MESSAGE
from blog.subscriptions import read_confirm_token

pytestmark = pytest.mark.django_db


def subscribe_url(slug: str) -> str:
    return reverse("public-subscribe", args=[slug])


CONFIRM_URL = reverse("public-subscription-confirm")
UNSUBSCRIBE_URL = reverse("public-subscription-unsubscribe")


@pytest.fixture
def open_site(site):
    site.subscriptions_enabled = True
    site.save(update_fields=["subscriptions_enabled"])
    return site


@pytest.fixture
def subscriber(open_site) -> Subscriber:
    return Subscriber.objects.create(site=open_site, email="reader@example.com")


def token_in(message) -> str:
    """
    The confirmation token out of a sent message's plain-text body.

    Unquoted, because the token is percent-encoded into the URL — the
    signature carries ':' separators, which would otherwise end the query
    string early. The browser decodes it before Next hands it to the page,
    so this stands in for that step.
    """
    match = re.search(r"token=([^\s&]+)", message.body)
    assert match, f"no confirm link in:\n{message.body}"
    return unquote(match.group(1))


class TestSubscribingSendsOne:
    def test_a_new_subscriber_is_mailed(self, api, open_site):
        api.post(
            subscribe_url(open_site.slug),
            {"email": "reader@example.com"},
            format="json",
        )

        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ["reader@example.com"]

    def test_the_timestamp_is_recorded(self, api, open_site):
        api.post(
            subscribe_url(open_site.slug),
            {"email": "reader@example.com"},
            format="json",
        )

        assert Subscriber.objects.get().confirmation_sent_at is not None

    def test_the_honeypot_sends_nothing(self, api, open_site):
        api.post(
            subscribe_url(open_site.slug),
            {"email": "bot@example.com", "website": "http://spam.example"},
            format="json",
        )

        assert mail.outbox == []

    def test_a_closed_blog_sends_nothing(self, api, site):
        api.post(
            subscribe_url(site.slug), {"email": "reader@example.com"}, format="json"
        )

        assert mail.outbox == []

    def test_an_invalid_address_sends_nothing(self, api, open_site):
        api.post(
            subscribe_url(open_site.slug), {"email": "not-an-address"}, format="json"
        )

        assert mail.outbox == []


class TestWhoIsNotMailed:
    def test_a_confirmed_subscriber_is_not_remailed(self, api, open_site, subscriber):
        """
        Otherwise the form is a way of mailing anybody who is already
        subscribed, as often as you like, by typing their address.
        """
        subscriber.status = Subscriber.Status.CONFIRMED
        subscriber.save(update_fields=["status"])

        api.post(
            subscribe_url(open_site.slug), {"email": subscriber.email}, format="json"
        )

        assert mail.outbox == []

    def test_but_the_answer_is_unchanged(self, api, open_site, subscriber):
        """Sending nothing must not be visible from outside."""
        subscriber.status = Subscriber.Status.CONFIRMED
        subscriber.save(update_fields=["status"])

        response = api.post(
            subscribe_url(open_site.slug), {"email": subscriber.email}, format="json"
        )

        assert response.status_code == 202
        assert response.json() == {"detail": SUBSCRIBE_MESSAGE}

    def test_an_unsubscribed_row_is_mailed_again(self, api, open_site, subscriber):
        """Re-subscribing is a fresh request, so it earns a fresh link."""
        subscriber.status = Subscriber.Status.UNSUBSCRIBED
        subscriber.save(update_fields=["status"])

        api.post(
            subscribe_url(open_site.slug), {"email": subscriber.email}, format="json"
        )

        assert len(mail.outbox) == 1

    def test_send_returns_false_for_a_confirmed_row(self, subscriber):
        subscriber.status = Subscriber.Status.CONFIRMED
        subscriber.save(update_fields=["status"])

        assert send_subscription_confirmation(subscriber) is False


class TestResendCooldown:
    """
    The subscribe throttle is per IP, which bounds how fast one machine can
    submit. This bounds how much mail can reach one inbox however many
    machines are doing the submitting.
    """

    def test_resubmitting_immediately_sends_nothing(self, api, open_site):
        for _ in range(4):
            api.post(
                subscribe_url(open_site.slug),
                {"email": "reader@example.com"},
                format="json",
            )

        assert len(mail.outbox) == 1

    def test_the_answer_is_still_unchanged(self, api, open_site):
        first = api.post(
            subscribe_url(open_site.slug),
            {"email": "reader@example.com"},
            format="json",
        )
        second = api.post(
            subscribe_url(open_site.slug),
            {"email": "reader@example.com"},
            format="json",
        )

        assert first.json() == second.json()

    def test_resends_once_the_interval_has_passed(self, api, open_site, subscriber):
        """A reader who genuinely never got the first one can ask again."""
        subscriber.confirmation_sent_at = timezone.now() - RESEND_INTERVAL
        subscriber.save(update_fields=["confirmation_sent_at"])

        api.post(
            subscribe_url(open_site.slug), {"email": subscriber.email}, format="json"
        )

        assert len(mail.outbox) == 1

    def test_still_held_off_just_inside_the_interval(self, api, open_site, subscriber):
        subscriber.confirmation_sent_at = timezone.now() - (
            RESEND_INTERVAL - timedelta(seconds=30)
        )
        subscriber.save(update_fields=["confirmation_sent_at"])

        api.post(
            subscribe_url(open_site.slug), {"email": subscriber.email}, format="json"
        )

        assert mail.outbox == []


class TestSendFailuresAreInvisible:
    """
    The subscribe endpoint must answer identically whether a message was
    due, sent, or impossible. Anything else makes an outage into a way of
    asking which addresses are already on a list.
    """

    @pytest.fixture
    def broken_mail(self, monkeypatch):
        def explode(*args, **kwargs):
            raise OSError("smtp is down")

        monkeypatch.setattr(
            "blog.emails.EmailMultiAlternatives.send", explode, raising=True
        )

    def test_subscribe_still_answers_202(self, api, open_site, broken_mail):
        response = api.post(
            subscribe_url(open_site.slug),
            {"email": "reader@example.com"},
            format="json",
        )

        assert response.status_code == 202
        assert response.json() == {"detail": SUBSCRIBE_MESSAGE}

    def test_the_row_is_still_created(self, api, open_site, broken_mail):
        api.post(
            subscribe_url(open_site.slug),
            {"email": "reader@example.com"},
            format="json",
        )

        assert Subscriber.objects.get().status == Subscriber.Status.PENDING

    def test_a_failed_send_does_not_start_the_cooldown(
        self, api, open_site, broken_mail
    ):
        """
        Otherwise a reader is held off for five minutes over a message
        that never arrived, and cannot retry.
        """
        api.post(
            subscribe_url(open_site.slug),
            {"email": "reader@example.com"},
            format="json",
        )

        assert Subscriber.objects.get().confirmation_sent_at is None

    def test_retrying_after_a_failure_sends(self, api, open_site, monkeypatch):
        """
        The whole point of not starting the cooldown on failure: the
        second attempt gets through the moment the mail server is back,
        with no five-minute wait for a message that never existed.
        """

        def explode(*args, **kwargs):
            raise OSError("smtp is down")

        with monkeypatch.context() as broken:
            broken.setattr("blog.emails.EmailMultiAlternatives.send", explode)
            api.post(
                subscribe_url(open_site.slug),
                {"email": "reader@example.com"},
                format="json",
            )

        assert mail.outbox == []

        # Mail is working again, and the reader resubmits straight away.
        api.post(
            subscribe_url(open_site.slug),
            {"email": "reader@example.com"},
            format="json",
        )

        assert len(mail.outbox) == 1

    def test_send_returns_false_rather_than_raising(self, subscriber, broken_mail):
        assert send_subscription_confirmation(subscriber) is False

    def test_the_failure_is_logged(self, subscriber, broken_mail, caplog):
        """Swallowed is not the same as unnoticed."""
        send_subscription_confirmation(subscriber)

        assert any(record.levelname == "ERROR" for record in caplog.records)


class TestTheMessage:
    @pytest.fixture(autouse=True)
    def sent(self, api, open_site):
        api.post(
            subscribe_url(open_site.slug),
            {"email": "reader@example.com"},
            format="json",
        )
        return mail.outbox[0]

    def test_subject_names_the_blog(self, sent, open_site):
        assert open_site.name in sent.subject

    def test_from_is_the_blogs_name_over_postlys_address(self, sent, open_site):
        """
        The reader recognises the blog, not Postly — but the domain has to
        stay one we can sign for, or the message fails DKIM alignment.
        """
        assert sent.from_email.startswith(f"{open_site.name} <")
        assert "postly.com" in sent.from_email

    def test_it_carries_a_plain_text_and_an_html_part(self, sent):
        """Not every reader's client renders HTML, and a text/plain part is
        also what keeps the message out of some spam filters."""
        assert sent.body.strip()
        assert [content_type for _, content_type in sent.alternatives] == ["text/html"]

    def test_the_link_points_at_the_blog_not_the_api(self, sent, open_site, settings):
        assert f"{settings.FRONTEND_URL}/{open_site.slug}/subscription/confirm" in (
            sent.body
        )

    def test_the_html_part_carries_the_same_link(self, sent, open_site, settings):
        html, _ = sent.alternatives[0]
        assert f"/{open_site.slug}/subscription/confirm" in html

    def test_the_html_is_branded_as_the_blog(self, sent, open_site):
        """A reader who typed their address into somebody's blog has no
        reason to recognise the word "Postly" at the top of a message."""
        html, _ = sent.alternatives[0]
        assert open_site.name in html

    def test_no_unrendered_template_syntax_escapes_into_the_message(self, sent):
        """
        Regression: a `{# ... #}` comment spread over several lines is not
        a comment — the hash form is single-line only — and Django emitted
        the whole thing into the body of every message. It rendered
        perfectly in the tests that only checked for the link, and was
        visible to every reader.
        """
        html, _ = sent.alternatives[0]

        for fragment in ("{#", "#}", "{%", "%}", "{{", "}}"):
            assert fragment not in html, f"{fragment!r} leaked into the HTML part"
            assert fragment not in sent.body, f"{fragment!r} leaked into the text part"

    def test_it_says_what_to_do_if_it_was_not_you(self, sent):
        """The one instruction that makes an unsolicited confirmation
        harmless: do nothing."""
        assert "ignore" in sent.body.lower()

    def test_the_token_confirms_the_right_subscriber(self, sent):
        subscriber = read_confirm_token(token_in(sent))

        assert subscriber.email == "reader@example.com"

    def test_the_link_actually_works_end_to_end(self, api, sent):
        response = api.post(CONFIRM_URL, {"token": token_in(sent)}, format="json")

        assert response.status_code == 200
        assert Subscriber.objects.get().status == Subscriber.Status.CONFIRMED

    def test_the_message_states_the_expiry(self, sent):
        assert "48 hours" in sent.body


class TestHelpers:
    def test_confirmation_url_is_absolute_and_escaped(self, subscriber, settings):
        url = confirmation_url(subscriber)

        assert url.startswith(settings.FRONTEND_URL)
        # signing.dumps() separates with ':', which has to survive the trip
        # through a query string.
        assert ":" not in url.split("token=")[1]

    def test_from_address_uses_the_subscription_setting(self, open_site, settings):
        settings.SUBSCRIPTION_FROM_EMAIL = "Postly <bulk@mail.postly.com>"

        assert from_address(open_site) == f"{open_site.name} <bulk@mail.postly.com>"

    def test_a_blog_name_with_a_comma_is_quoted(self, open_site, settings):
        """An unquoted comma in a display name splits the header into two
        recipients as far as some MTAs are concerned."""
        open_site.name = "Wren, Briefly"
        open_site.save(update_fields=["name"])

        assert from_address(open_site).startswith('"Wren, Briefly" <')
