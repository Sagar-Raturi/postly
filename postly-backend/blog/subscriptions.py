"""
The confirmation token, and the two state changes a reader can make.

Kept out of the views so the rules live in one readable place, and out of
models.py because a signature is not a column — see the Subscriber docstring
for why the confirm token is stateless and the unsubscribe token is not.

The whole of the reader-facing subscription lifecycle is here:

    subscribe  -> pending     (public_views.SubscribeView creates the row)
    confirm    -> confirmed   (confirm_subscriber, below)
    unsubscribe-> unsubscribed(unsubscribe_subscriber, below)

Nothing in this module sends mail. Phase 2 adds that on top; Phase 1
mints the token and exposes the endpoints that spend it, which is what
lets the flow be tested end to end before a single message goes out.
"""

from django.core import signing
from django.utils import timezone

from .models import Subscriber

# Namespaces the signature. Without a distinct salt, a token minted here
# would verify anywhere else in the project that unsigns with the default,
# and vice versa — the salt is what makes this signature mean "a Postly
# subscription confirmation" rather than merely "signed by Postly".
CONFIRM_SALT = "blog.subscriptions.confirm"

# Two days. Long enough to survive a weekend and a spam folder, short
# enough that a link forwarded or archived years later is not a standing
# permission to add somebody to a mailing list.
CONFIRM_MAX_AGE_SECONDS = 60 * 60 * 48


class InvalidConfirmToken(Exception):
    """The token was forged, expired, or no longer describes a real row."""


def make_confirm_token(subscriber: Subscriber) -> str:
    """
    An expiring signature over the row's id *and* its address.

    The address is in there for one reason: it pins the token to the
    subscription it was minted for. A token carrying only an id would
    still verify if that id were later reused by a different row, or if
    the address on the row changed after the mail went out — in both cases
    confirming somebody who never asked. Carrying the address means the
    check in confirm_subscriber() can notice and refuse.
    """
    return signing.dumps(
        {"pk": subscriber.pk, "email": subscriber.email},
        salt=CONFIRM_SALT,
    )


def read_confirm_token(token: str) -> Subscriber:
    """
    The subscriber a token names, or raise InvalidConfirmToken.

    Every failure raises the same exception with no detail about which one
    it was. A caller — and therefore the endpoint, and therefore anybody
    on the internet — learns only "that link does not work", never "that
    link is real but expired" or "no such subscriber", either of which is
    a small amount of information about somebody else's mailing list.
    """
    try:
        payload = signing.loads(
            token or "", salt=CONFIRM_SALT, max_age=CONFIRM_MAX_AGE_SECONDS
        )
    except signing.BadSignature as exc:
        # Covers SignatureExpired too, which subclasses it.
        raise InvalidConfirmToken from exc

    if not isinstance(payload, dict):
        raise InvalidConfirmToken

    try:
        subscriber = Subscriber.objects.select_related("site").get(pk=payload.get("pk"))
    except Subscriber.DoesNotExist as exc:
        raise InvalidConfirmToken from exc

    # The signature proves the payload is ours and unaltered; this proves
    # the row still is what the payload described.
    if subscriber.email != payload.get("email"):
        raise InvalidConfirmToken

    return subscriber


def confirm_subscriber(subscriber: Subscriber) -> Subscriber:
    """
    Move a row to `confirmed`, and record when.

    Idempotent on purpose: a reader who clicks the link twice, or whose
    mail client prefetched it, gets the same answer as the first time
    rather than an error page about a link they just used successfully.

    An `unsubscribed` row is *not* revived here. Following an old
    confirmation link must never undo a later decision to leave — the
    unsubscribe is the newer instruction, and honouring the older one
    would be exactly the bug that gets a sending domain blocklisted. Such
    a reader has to subscribe again, which mints a new token.
    """
    if subscriber.status != Subscriber.Status.PENDING:
        return subscriber

    subscriber.status = Subscriber.Status.CONFIRMED
    subscriber.confirmed_at = timezone.now()
    subscriber.save(update_fields=["status", "confirmed_at"])
    return subscriber


def unsubscribe_subscriber(subscriber: Subscriber) -> Subscriber:
    """
    Move a row to `unsubscribed`, whatever it was before.

    Also idempotent, and for a stronger reason than confirm: an
    unsubscribe that answers "that did not work" is a compliance problem
    and a complaint waiting to happen. Clicking twice says "you are
    unsubscribed" twice.

    The row is kept rather than deleted. A deleted address is one that can
    be silently re-added by the next form submission; a row that says
    `unsubscribed` is a standing instruction that survives.
    """
    if subscriber.status == Subscriber.Status.UNSUBSCRIBED:
        return subscriber

    subscriber.status = Subscriber.Status.UNSUBSCRIBED
    subscriber.unsubscribed_at = timezone.now()
    subscriber.save(update_fields=["status", "unsubscribed_at"])
    return subscriber


# Statuses a provider event may move a row out of.
#
# `unsubscribed` is absent deliberately: somebody who chose to leave has
# already made the stronger statement, and overwriting that with "bounced"
# would erase the record of their decision. A row that has already been
# suppressed is likewise left alone, so a retried webhook changes nothing.
SUPPRESSIBLE_STATUSES = (Subscriber.Status.PENDING, Subscriber.Status.CONFIRMED)


def suppress_address(email: str, *, reason: str) -> int:
    """
    Stop mailing an address, on every blog. Returns how many rows changed.

    **Across every blog, not just the one that sent the message**, and that
    is the decision worth explaining, because it is not obviously right.

    For a hard bounce it plainly is: the mailbox does not exist, and which
    blog discovered that is irrelevant.

    For a spam complaint it is a judgement call. The reader complained
    about one writer's post, and it is one writer's list they meant to
    leave. But the complaint is not recorded against that writer by the
    mailbox provider — it is recorded against the domain every blog on
    Postly sends from. A reader who has called that domain's mail spam
    once and keeps receiving it from four other blogs will press the button
    four more times, and the rate that gets a domain filtered is measured
    per domain. So the address is suppressed everywhere. The cost is a
    subscription that person might have wanted to keep; the alternative
    cost is every writer's mail going to spam.

    Idempotent: a provider that delivers the same event twice — which they
    all do — changes nothing the second time.
    """
    updates = {"status": reason}

    # A complaint is somebody choosing to stop, so it is stamped like the
    # other kind of choosing. A bounce is not a decision by anybody, and
    # leaving `unsubscribed_at` null there is what keeps the two
    # distinguishable when they are counted later.
    if reason == Subscriber.Status.COMPLAINED:
        updates["unsubscribed_at"] = timezone.now()

    return Subscriber.objects.filter(
        email=Subscriber.normalize_email(email),
        status__in=SUPPRESSIBLE_STATUSES,
    ).update(**updates)
