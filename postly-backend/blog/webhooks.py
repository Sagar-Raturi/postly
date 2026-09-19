"""
What the mail provider tells us after a message leaves.

Sending is only half of deliverability. The other half is listening: an
address that hard-bounced and an address whose owner pressed "report spam"
must both stop receiving mail immediately, and neither of them will ever
click an unsubscribe link to say so. Every message we keep sending to those
two is a direct debit against the sending domain's reputation — which, on a
multi-tenant platform, is every writer's reputation and Postly's own
password-reset mail.

So this module is small and does one thing: take Resend's webhook, prove it
is really Resend's, and suppress the address.

## Verifying the signature

Resend signs webhooks with Svix's scheme, and this implements it directly
rather than adding the `svix` package. It is an HMAC and a constant-time
compare — about fifteen lines — against a dependency that would be pulled
in for exactly this one call. The scheme:

    signed = f"{svix-id}.{svix-timestamp}.{raw body}"
    expected = base64(hmac_sha256(secret, signed))

where `secret` is the part of `whsec_…` after the prefix, base64-decoded.
The `svix-signature` header carries a space-separated list of `v1,<sig>`
entries — a list, because a secret being rotated means two are valid at
once — and the request is genuine if any of them matches.

**The raw body is what is signed**, not a re-serialization of the parsed
JSON. `json.dumps(json.loads(body))` is not byte-identical to `body` and
the signature would never match.

## Why an unverified webhook would be worse than no webhook

This endpoint is unauthenticated, public, and its whole purpose is to stop
mailing people. Without a signature check, anybody who learned the URL could
post `{"type": "email.bounced", "data": {"to": ["someone@example.com"]}}`
and silently remove any reader from every list on the platform — with no
audit trail and no way for the reader to notice until they wondered why the
blog had gone quiet. That is why a failed verification is refused before
the body is looked at, and why an unset secret refuses everything rather
than waving requests through.
"""

import base64
import hashlib
import hmac
import json
import logging
import time

from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Subscriber
from .subscriptions import suppress_address

logger = logging.getLogger(__name__)

# How far a webhook's timestamp may be from now. Svix's own recommendation,
# and the reason it exists is replay: without it, a genuine signed request
# captured off the wire stays valid forever.
TIMESTAMP_TOLERANCE_SECONDS = 5 * 60

# What each event does to a subscriber. Anything not listed here is
# acknowledged and ignored — `email.sent`, `email.delivered`, `opened`,
# `clicked` and the rest are all real events we have no use for, and a 400
# for them would make the provider retry something that worked.
SUPPRESSING_EVENTS = {
    "email.bounced": Subscriber.Status.BOUNCED,
    "email.complained": Subscriber.Status.COMPLAINED,
}

# Bounce classifications that must NOT suppress an address.
#
# A full mailbox or a server having a bad afternoon is temporary, and
# striking somebody off the list for it loses a real subscriber over
# something that fixes itself. Anything else — including a bounce with no
# classification at all — is treated as permanent, because the cost of
# continuing to mail a dead address is paid by every other blog on the
# domain.
TRANSIENT_BOUNCE_TYPES = {"soft", "transient", "temporary", "delayed"}


class InvalidSignature(Exception):
    """The request did not come from the provider."""


def verify_signature(request) -> None:
    """Raise InvalidSignature unless this really is our provider's webhook."""
    secret = settings.RESEND_WEBHOOK_SECRET

    # An unset secret refuses everything. The tempting alternative — skip
    # verification when unconfigured, so it "works out of the box" — turns
    # a forgotten environment variable into an open endpoint that anybody
    # can use to unsubscribe anybody.
    if not secret:
        raise InvalidSignature("No webhook secret is configured.")

    msg_id = request.headers.get("svix-id", "")
    timestamp = request.headers.get("svix-timestamp", "")
    signatures = request.headers.get("svix-signature", "")

    if not (msg_id and timestamp and signatures):
        raise InvalidSignature("Missing signature headers.")

    try:
        age = abs(time.time() - int(timestamp))
    except ValueError as exc:
        raise InvalidSignature("Unparseable timestamp.") from exc

    if age > TIMESTAMP_TOLERANCE_SECONDS:
        raise InvalidSignature("Timestamp outside the replay window.")

    # request.body, not request.data: the signature covers the bytes that
    # were sent. Re-serialising the parsed JSON produces different bytes
    # and would never match.
    signed = b"%s.%s.%s" % (msg_id.encode(), timestamp.encode(), request.body)

    key = secret.split("_", 1)[1] if secret.startswith("whsec_") else secret
    try:
        expected = base64.b64encode(
            hmac.new(base64.b64decode(key), signed, hashlib.sha256).digest()
        ).decode()
    except (ValueError, TypeError) as exc:
        raise InvalidSignature("Malformed webhook secret.") from exc

    # A space-separated list, because a secret mid-rotation has two valid
    # signatures at once. compare_digest on each, so a near-miss takes the
    # same time as a wild one.
    for entry in signatures.split():
        _, _, candidate = entry.partition(",")
        if candidate and hmac.compare_digest(candidate, expected):
            return

    raise InvalidSignature("No signature matched.")


def recipients_of(payload: dict) -> list[str]:
    """
    The addresses an event is about.

    `to` is a list in the provider's payload even when there is one
    recipient — and there always is one here, because each notification is
    an individual message so that it can carry an individual unsubscribe
    link.
    """
    data = payload.get("data")
    if not isinstance(data, dict):
        return []

    to = data.get("to")
    if isinstance(to, str):
        return [to]
    return [address for address in (to or []) if isinstance(address, str)]


def is_transient_bounce(payload: dict) -> bool:
    """Whether a bounce says it is the temporary kind."""
    data = payload.get("data")
    bounce = data.get("bounce") if isinstance(data, dict) else None
    if not isinstance(bounce, dict):
        return False

    kind = str(bounce.get("type") or "").strip().lower()
    return kind in TRANSIENT_BOUNCE_TYPES


class ResendWebhookView(APIView):
    """
    POST /api/webhooks/resend/ — bounce and complaint events.

    Unauthenticated in the session sense and authenticated in the only
    sense that matters here: the signature. `authentication_classes` is
    empty for the same reason as the public subscription endpoints — there
    is no user, and the project default would try to CSRF-check a caller
    that has no session and cannot have a token.

    **Almost everything answers 200.** An unrecognised event type, an event
    about an address nobody subscribed, a duplicate of one already handled —
    all 200, because the provider retries anything else with backoff and
    then gives up, and a retry storm over an event we deliberately ignore
    helps nobody. Only a bad signature is refused, and that one has to be.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    # No throttle scope. A provider retrying a burst of genuine events must
    # not be rate-limited into silence — an event we throttle away is an
    # address we keep mailing after it bounced. The signature check is what
    # bounds who can reach this at all.
    throttle_classes = []

    def post(self, request):
        try:
            verify_signature(request)
        except InvalidSignature as exc:
            # Logged at warning, not error: an unsigned POST to this URL is
            # somebody scanning, which is expected background noise on a
            # public endpoint rather than a fault in the system.
            logger.warning("Rejected webhook: %s", exc)
            return Response(
                {"detail": "Invalid signature."}, status=status.HTTP_401_UNAUTHORIZED
            )

        try:
            payload = json.loads(request.body)
        except (ValueError, TypeError):
            return Response(
                {"detail": "Malformed payload."}, status=status.HTTP_400_BAD_REQUEST
            )

        if not isinstance(payload, dict):
            return Response(
                {"detail": "Malformed payload."}, status=status.HTTP_400_BAD_REQUEST
            )

        event = payload.get("type")
        reason = SUPPRESSING_EVENTS.get(event)

        if reason is None:
            return Response({"detail": "Ignored."})

        if reason == Subscriber.Status.BOUNCED and is_transient_bounce(payload):
            logger.info("Transient bounce ignored for %s", recipients_of(payload))
            return Response({"detail": "Ignored."})

        suppressed = 0
        for address in recipients_of(payload):
            suppressed += suppress_address(address, reason=reason)

        if suppressed:
            # At info, and worth having: a complaint is the single most
            # expensive thing that can happen to the sending domain, and
            # the first sign of a writer mailing people who did not ask is
            # this line appearing repeatedly.
            logger.info("%s suppressed %s row(s)", event, suppressed)

        return Response({"detail": "Handled.", "suppressed": suppressed})
