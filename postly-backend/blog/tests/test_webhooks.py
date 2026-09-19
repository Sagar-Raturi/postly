"""
Provider callbacks: proving they are genuine, and acting on them.

The signature check carries almost all the weight here. This endpoint is
public, unauthenticated in the session sense, and its effect is to stop
mailing somebody — so a forged request is a way to silently remove any
reader from every list on the platform. Most of what follows is an attempt
to forge one.

The rest covers what a verified event does: a hard bounce and a spam
complaint both suppress an address everywhere, a transient bounce suppresses
nothing, and a replayed event changes nothing the second time.
"""

import base64
import hashlib
import hmac
import json
import time

import pytest
from django.urls import reverse
from django.utils import timezone

from blog.models import Subscriber

pytestmark = pytest.mark.django_db

WEBHOOK_URL = reverse("resend-webhook")

# The shape of a real secret: "whsec_" then base64. The bytes are nonsense
# on purpose — nothing here should ever be a key that exists anywhere.
SECRET = "whsec_" + base64.b64encode(b"postly-test-signing-key").decode()


def sign(body: bytes, *, secret: str = SECRET, msg_id: str = "msg_1", timestamp=None):
    """Headers Resend would send. Mirrors Svix's scheme — see webhooks.py."""
    timestamp = str(int(time.time())) if timestamp is None else str(timestamp)
    key = base64.b64decode(secret.split("_", 1)[1])
    signed = b"%s.%s.%s" % (msg_id.encode(), timestamp.encode(), body)
    signature = base64.b64encode(
        hmac.new(key, signed, hashlib.sha256).digest()
    ).decode()

    return {
        "HTTP_SVIX_ID": msg_id,
        "HTTP_SVIX_TIMESTAMP": timestamp,
        "HTTP_SVIX_SIGNATURE": f"v1,{signature}",
    }


def event(kind: str, address: str, **data) -> bytes:
    return json.dumps({"type": kind, "data": {"to": [address], **data}}).encode()


def post(api, body: bytes, headers: dict | None = None, *, secret: str = SECRET):
    return api.post(
        WEBHOOK_URL,
        data=body,
        content_type="application/json",
        **(sign(body, secret=secret) if headers is None else headers),
    )


@pytest.fixture(autouse=True)
def webhook_secret(settings):
    settings.RESEND_WEBHOOK_SECRET = SECRET
    return SECRET


@pytest.fixture
def open_site(site):
    site.subscriptions_enabled = True
    site.save(update_fields=["subscriptions_enabled"])
    return site


@pytest.fixture
def reader(open_site) -> Subscriber:
    return Subscriber.objects.create(
        site=open_site,
        email="reader@example.com",
        status=Subscriber.Status.CONFIRMED,
        confirmed_at=timezone.now(),
    )


class TestForgeryIsRefused:
    """
    Everything here is an attempt to make the endpoint act without a valid
    signature. All of them must 401, and none may change a row.
    """

    def test_no_headers_at_all(self, api, reader):
        response = api.post(
            WEBHOOK_URL,
            data=event("email.bounced", reader.email),
            content_type="application/json",
        )

        assert response.status_code == 401
        reader.refresh_from_db()
        assert reader.status == Subscriber.Status.CONFIRMED

    def test_a_signature_from_the_wrong_secret(self, api, reader):
        wrong = "whsec_" + base64.b64encode(b"not-the-real-key").decode()
        body = event("email.bounced", reader.email)

        response = api.post(
            WEBHOOK_URL,
            data=body,
            content_type="application/json",
            **sign(body, secret=wrong),
        )

        assert response.status_code == 401
        reader.refresh_from_db()
        assert reader.status == Subscriber.Status.CONFIRMED

    def test_a_body_swapped_after_signing(self, api, reader, open_site):
        """
        The signature covers the bytes, so an attacker who captures a
        genuine event cannot retarget it at somebody else.
        """
        signed_body = event("email.bounced", "someone-else@example.com")
        headers = sign(signed_body)
        tampered = event("email.bounced", reader.email)

        response = api.post(
            WEBHOOK_URL, data=tampered, content_type="application/json", **headers
        )

        assert response.status_code == 401
        reader.refresh_from_db()
        assert reader.status == Subscriber.Status.CONFIRMED

    def test_an_old_timestamp(self, api, reader):
        """Replay: a genuine signed request captured off the wire must not
        stay valid forever."""
        body = event("email.bounced", reader.email)
        headers = sign(body, timestamp=int(time.time()) - 3600)

        assert post(api, body, headers).status_code == 401

    def test_a_future_timestamp(self, api, reader):
        body = event("email.bounced", reader.email)
        headers = sign(body, timestamp=int(time.time()) + 3600)

        assert post(api, body, headers).status_code == 401

    def test_an_unparseable_timestamp(self, api, reader):
        body = event("email.bounced", reader.email)
        headers = sign(body)
        headers["HTTP_SVIX_TIMESTAMP"] = "the day before yesterday"

        assert post(api, body, headers).status_code == 401

    @pytest.mark.parametrize(
        "header",
        ["HTTP_SVIX_ID", "HTTP_SVIX_TIMESTAMP", "HTTP_SVIX_SIGNATURE"],
    )
    def test_each_header_is_required(self, api, reader, header):
        body = event("email.bounced", reader.email)
        headers = sign(body)
        del headers[header]

        assert post(api, body, headers).status_code == 401

    def test_a_signature_for_a_different_message_id(self, api, reader):
        body = event("email.bounced", reader.email)
        headers = sign(body, msg_id="msg_1")
        headers["HTTP_SVIX_ID"] = "msg_2"

        assert post(api, body, headers).status_code == 401

    def test_an_empty_signature_value(self, api, reader):
        body = event("email.bounced", reader.email)
        headers = sign(body)
        headers["HTTP_SVIX_SIGNATURE"] = "v1,"

        assert post(api, body, headers).status_code == 401

    def test_an_unset_secret_refuses_everything(self, api, reader, settings):
        """
        The tempting alternative — skip verification when unconfigured —
        would turn a forgotten environment variable into an open endpoint
        for unsubscribing anybody.
        """
        body = event("email.bounced", reader.email)
        headers = sign(body)
        settings.RESEND_WEBHOOK_SECRET = ""

        assert post(api, body, headers).status_code == 401

    def test_a_malformed_secret_refuses_rather_than_crashing(
        self, api, reader, settings
    ):
        body = event("email.bounced", reader.email)
        headers = sign(body)
        settings.RESEND_WEBHOOK_SECRET = "whsec_not~valid~base64~at~all"

        assert post(api, body, headers).status_code == 401


class TestGenuineEventsAreAccepted:
    def test_a_correct_signature_is_accepted(self, api, reader):
        assert post(api, event("email.bounced", reader.email)).status_code == 200

    def test_several_signatures_during_a_rotation(self, api, reader):
        """Svix sends a space-separated list while a secret is being
        rotated; any one of them matching is enough."""
        body = event("email.bounced", reader.email)
        headers = sign(body)
        genuine = headers["HTTP_SVIX_SIGNATURE"]
        headers["HTTP_SVIX_SIGNATURE"] = f"v1,AAAA {genuine}"

        assert post(api, body, headers).status_code == 200

    def test_no_session_or_csrf_token_is_needed(self, api, reader):
        """The provider has neither, and the project default would try to
        CSRF-check a caller that cannot have a token."""
        response = post(api, event("email.bounced", reader.email))

        assert response.status_code != 403


class TestBounces:
    def test_a_hard_bounce_suppresses(self, api, reader):
        post(api, event("email.bounced", reader.email))

        reader.refresh_from_db()
        assert reader.status == Subscriber.Status.BOUNCED
        assert reader.is_active is False

    def test_a_bounce_is_not_recorded_as_a_decision(self, api, reader):
        """Nobody chose anything, so unsubscribed_at stays null — which is
        what keeps bounces and complaints countable apart."""
        post(api, event("email.bounced", reader.email))

        reader.refresh_from_db()
        assert reader.unsubscribed_at is None

    @pytest.mark.parametrize("kind", ["soft", "Transient", "TEMPORARY", "delayed"])
    def test_a_transient_bounce_suppresses_nothing(self, api, reader, kind):
        """A full mailbox fixes itself; striking somebody off for it loses
        a real subscriber over nothing."""
        post(api, event("email.bounced", reader.email, bounce={"type": kind}))

        reader.refresh_from_db()
        assert reader.status == Subscriber.Status.CONFIRMED

    def test_a_hard_classification_suppresses(self, api, reader):
        post(api, event("email.bounced", reader.email, bounce={"type": "hard"}))

        reader.refresh_from_db()
        assert reader.status == Subscriber.Status.BOUNCED

    def test_an_unclassified_bounce_suppresses(self, api, reader):
        """Unknown is treated as permanent: the cost of mailing a dead
        address is paid by every other blog on the domain."""
        post(api, event("email.bounced", reader.email, bounce={}))

        reader.refresh_from_db()
        assert reader.status == Subscriber.Status.BOUNCED


class TestComplaints:
    def test_a_complaint_suppresses(self, api, reader):
        post(api, event("email.complained", reader.email))

        reader.refresh_from_db()
        assert reader.status == Subscriber.Status.COMPLAINED
        assert reader.is_active is False

    def test_a_complaint_is_recorded_as_a_decision(self, api, reader):
        post(api, event("email.complained", reader.email))

        reader.refresh_from_db()
        assert reader.unsubscribed_at is not None

    def test_it_is_kept_apart_from_an_ordinary_unsubscribe(self, api, reader):
        """
        Both mean "never mail again", but only one of them is the number
        that gets a sending domain filtered, so they have to be countable
        separately.
        """
        post(api, event("email.complained", reader.email))

        reader.refresh_from_db()
        assert reader.status != Subscriber.Status.UNSUBSCRIBED


class TestSuppressionReachesEveryBlog:
    @pytest.fixture
    def everywhere(self, open_site, other_site):
        other_site.subscriptions_enabled = True
        other_site.save(update_fields=["subscriptions_enabled"])
        return [
            Subscriber.objects.create(
                site=each,
                email="reader@example.com",
                status=Subscriber.Status.CONFIRMED,
                confirmed_at=timezone.now(),
            )
            for each in (open_site, other_site)
        ]

    def test_a_bounce_suppresses_the_address_on_every_blog(self, api, everywhere):
        """The mailbox is gone; which blog found out is irrelevant."""
        post(api, event("email.bounced", "reader@example.com"))

        for row in everywhere:
            row.refresh_from_db()
            assert row.status == Subscriber.Status.BOUNCED

    def test_a_complaint_suppresses_the_address_on_every_blog(self, api, everywhere):
        """
        The complaint is recorded by the mailbox provider against the
        domain every blog shares, not against the one writer. A reader who
        keeps receiving mail from four other blogs presses the button four
        more times.
        """
        post(api, event("email.complained", "reader@example.com"))

        for row in everywhere:
            row.refresh_from_db()
            assert row.status == Subscriber.Status.COMPLAINED

    def test_the_address_is_matched_case_insensitively(self, api, reader):
        post(api, event("email.bounced", "READER@Example.COM"))

        reader.refresh_from_db()
        assert reader.status == Subscriber.Status.BOUNCED


class TestWhatIsLeftAlone:
    def test_an_unsubscribed_row_keeps_its_decision(self, api, reader):
        """Overwriting it with "bounced" would erase the record that they
        chose to leave."""
        reader.status = Subscriber.Status.UNSUBSCRIBED
        reader.save(update_fields=["status"])

        post(api, event("email.bounced", reader.email))

        reader.refresh_from_db()
        assert reader.status == Subscriber.Status.UNSUBSCRIBED

    def test_a_pending_row_is_suppressed_too(self, api, open_site):
        """A confirmation that hard-bounced is an address worth not
        retrying."""
        pending = Subscriber.objects.create(site=open_site, email="new@example.com")

        post(api, event("email.bounced", pending.email))

        pending.refresh_from_db()
        assert pending.status == Subscriber.Status.BOUNCED

    def test_an_address_nobody_subscribed_is_fine(self, api):
        response = post(api, event("email.bounced", "stranger@example.com"))

        assert response.status_code == 200
        assert response.json()["suppressed"] == 0


class TestEventsWeDoNotAct_On:
    @pytest.mark.parametrize(
        "kind",
        ["email.sent", "email.delivered", "email.opened", "email.clicked", "nonsense"],
    )
    def test_they_are_acknowledged_not_refused(self, api, reader, kind):
        """
        200, because anything else makes the provider retry with backoff
        and eventually give up — a retry storm over an event we chose to
        ignore.
        """
        response = post(api, event(kind, reader.email))

        assert response.status_code == 200
        reader.refresh_from_db()
        assert reader.status == Subscriber.Status.CONFIRMED

    def test_a_malformed_body_is_a_400(self, api):
        assert post(api, b"{not json").status_code == 400

    def test_a_json_array_is_a_400(self, api):
        assert post(api, b"[1, 2, 3]").status_code == 400

    def test_a_body_with_no_recipients_is_fine(self, api):
        body = json.dumps({"type": "email.bounced", "data": {}}).encode()

        assert post(api, body).status_code == 200


class TestIdempotence:
    def test_a_redelivered_event_changes_nothing(self, api, reader):
        """Every provider delivers some events more than once."""
        body = event("email.complained", reader.email)

        first = post(api, body)
        second = post(api, body)

        assert first.json()["suppressed"] == 1
        assert second.json()["suppressed"] == 0
        reader.refresh_from_db()
        assert reader.status == Subscriber.Status.COMPLAINED

    def test_the_timestamp_is_not_overwritten_on_redelivery(self, api, reader):
        body = event("email.complained", reader.email)
        post(api, body)
        reader.refresh_from_db()
        first_time = reader.unsubscribed_at

        post(api, body)

        reader.refresh_from_db()
        assert reader.unsubscribed_at == first_time
