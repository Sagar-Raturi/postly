"""
Mail sent to a blog's readers, as opposed to mail sent to its writer.

The account mail — verification, password reset — belongs to allauth and is
configured in settings. This module owns the other kind: messages to people
who have no Postly account and never will, about one writer's blog.

Three things make that different from account mail, and each one shows up in
the code below:

* **The reader has not heard of Postly.** They typed their address into
  somebody's blog. So the message is from that blog's name, is about that
  blog, and mentions Postly only in the footer.
* **Nobody is waiting on an HTTP response.** A person who submits the
  subscribe form is told to check their inbox either way, so a send failure
  must not change what the API answers — see send_subscription_confirmation.
* **The address is unverified by definition.** Everything here goes to
  somebody who has not yet proved the address is theirs, which is why the
  resend cooldown exists at all.

Both kinds of message live here: the one-off confirmation a reader gets
when they sign up, and the fan-out when a post is published. The second
half of the file is the fan-out, and it is written around one SMTP
connection reused across batches rather than a message at a time.
"""

import logging
from datetime import timedelta
from email.utils import formataddr, parseaddr
from urllib.parse import quote

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.db.models import Sum
from django.template.loader import render_to_string
from django.utils import timezone

from .models import Subscriber
from .subscriptions import CONFIRM_MAX_AGE_SECONDS, make_confirm_token

logger = logging.getLogger(__name__)

# How long an address is left alone after a confirmation goes to it.
#
# Paired with the per-IP throttle on the subscribe endpoint, not a
# replacement for it: that one bounds how fast a single machine can submit,
# this one bounds how much mail can reach one inbox however many machines
# are submitting. Five minutes is long enough to make flooding pointless and
# short enough that a reader who genuinely did not get the first message can
# ask again while they are still on the page.
RESEND_INTERVAL = timedelta(minutes=5)


def confirmation_url(subscriber: Subscriber) -> str:
    """
    Where the link in the message points: a page on the blog, not the API.

    Two things are deliberate. It goes to the *frontend*, because this
    backend renders no pages for people. And it goes to a page rather than
    to the confirm endpoint itself, because mail scanners fetch every URL
    in a message before a person sees it — a link that confirmed on GET
    would let a security gateway complete the opt-in. The page makes the
    POST, which a scanner fetching HTML does not. See
    ConfirmSubscriptionView.
    """
    # quote() because the signature is base64-ish and carries ':'
    # separators, and a token that ends the query string early is a token
    # that does not work.
    token = quote(make_confirm_token(subscriber))
    return (
        f"{settings.FRONTEND_URL}/{subscriber.site.slug}"
        f"/subscription/confirm?token={token}"
    )


def from_address(site) -> str:
    """
    The blog's name over Postly's sending address.

    The display name is the blog's because that is what the reader
    recognises — "Small Hours" in an inbox means something to them and
    "Postly" does not. The address stays one we control, because the
    domain is what SPF and DKIM authenticate; putting the writer's own
    address there would fail alignment at every serious mailbox provider
    and send the message to spam.

    SUBSCRIPTION_FROM_EMAIL is separate from DEFAULT_FROM_EMAIL so Phase 4
    can move bulk mail onto its own subdomain — and its own reputation —
    without touching this code or the account mail beside it.
    """
    _, address = parseaddr(settings.SUBSCRIPTION_FROM_EMAIL)
    return formataddr((site.name, address))


def may_resend(subscriber: Subscriber, *, now=None) -> bool:
    """Whether enough time has passed to mail this address again."""
    if subscriber.confirmation_sent_at is None:
        return True

    now = now or timezone.now()
    return now - subscriber.confirmation_sent_at >= RESEND_INTERVAL


def send_subscription_confirmation(subscriber: Subscriber) -> bool:
    """
    Send the "confirm your subscription" message. Returns whether one went.

    False is an ordinary answer, not an error. It means one of:

    * the row is not `pending`, so there is nothing to confirm — this is
      what stops a confirmed subscriber being re-mailed every time somebody
      types their address into the form;
    * a message went to this address within RESEND_INTERVAL;
    * the send failed.

    **A failed send is swallowed, logged, and answered like a success.**
    That looks wrong and is deliberate. The alternative — letting the
    exception reach the view and become a 5xx — would make the subscribe
    endpoint answer differently depending on whether a message needed
    sending, and whether a message needs sending is exactly the fact the
    endpoint refuses to disclose. During an outage, a confirmed address
    would return 202 while an unknown one returned 503, and the form would
    have become the address-enumeration oracle that every other decision
    in this feature is arranged to prevent. A transient outage that
    confuses somebody for ten minutes is the better failure.

    `confirmation_sent_at` is left alone when the send fails, so the reader
    can resubmit the form immediately and have it retried rather than being
    held off by a cooldown for a message that never arrived.
    """
    if subscriber.status != Subscriber.Status.PENDING:
        return False

    if not may_resend(subscriber):
        return False

    context = {
        "site_name": subscriber.site.name,
        "confirm_url": confirmation_url(subscriber),
        "expiry_hours": CONFIRM_MAX_AGE_SECONDS // 3600,
    }

    try:
        message = EmailMultiAlternatives(
            subject=render_to_string(
                "blog/email/subscription_confirm_subject.txt", context
            ).strip(),
            body=render_to_string(
                "blog/email/subscription_confirm_message.txt", context
            ),
            from_email=from_address(subscriber.site),
            to=[subscriber.email],
        )
        message.attach_alternative(
            render_to_string("blog/email/subscription_confirm_message.html", context),
            "text/html",
        )
        message.send()
    except Exception:
        # Broad on purpose. A template error and a refused SMTP connection
        # have to produce the same HTTP response, for the reason in the
        # docstring — so the net is cast wide enough that nothing escapes
        # and changes it. `exception` rather than `error` so the traceback
        # survives into the logs, which is where this is meant to be
        # noticed.
        logger.exception(
            "Could not send subscription confirmation for subscriber %s", subscriber.pk
        )
        return False

    subscriber.confirmation_sent_at = timezone.now()
    subscriber.save(update_fields=["confirmation_sent_at"])
    return True


# ---------------------------------------------------------------------- #
# New-post notifications
# ---------------------------------------------------------------------- #

# Recipients per SMTP connection flush.
#
# Small enough that a crash costs at most this many duplicate messages on
# the retry (see PostEmail's docstring on the cursor), large enough that the
# per-batch bookkeeping is not the dominant cost. The connection is reused
# across batches either way — it is the flush that is batched, not the
# handshake.
BATCH_SIZE = 50

# How many times a run may fail before the row is left alone for a person.
MAX_ATTEMPTS = 3


def post_url(post) -> str:
    """The published post, on the blog, for the "read it" link."""
    return f"{settings.FRONTEND_URL}/{post.site.slug}/{post.slug}"


def unsubscribe_url(subscriber: Subscriber) -> str:
    """
    This subscriber's own unsubscribe link.

    Per recipient, which is the reason every notification is an individual
    message rather than one message with five hundred people on it. A
    BCC'd newsletter cannot carry a per-person unsubscribe link, and the
    one thing worse than that is a CC'd one, which hands every reader
    everybody else's address.
    """
    return (
        f"{settings.FRONTEND_URL}/{subscriber.site.slug}/subscription/unsubscribe"
        f"?token={quote(subscriber.unsubscribe_token)}"
    )


def schedule_post_email(post) -> "models.Model | None":
    """
    Queue a notification for a post that has just been published.

    Returns the row, or None when there is nothing to queue. Nothing is
    queued when:

    * the blog has not switched subscriptions on;
    * the post is not actually published;
    * a row already exists — which is the case that matters. A post that
      was published, unpublished after its mail went out, and published
      again does not notify anybody a second time, because the row from
      the first time is still sitting there saying `sent`.

    The delay is what makes an unpublish able to catch a mistake. See
    POST_EMAIL_DELAY_MINUTES in settings for why it is not zero.
    """
    from .models import PostEmail  # local: models imports nothing from here

    if not post.site.subscriptions_enabled or not post.is_published:
        return None

    row, created = PostEmail.objects.get_or_create(
        post=post,
        defaults={
            "scheduled_for": timezone.now()
            + timedelta(minutes=settings.POST_EMAIL_DELAY_MINUTES)
        },
    )
    return row if created else None


def cancel_post_email(post) -> bool:
    """
    Drop a queued notification, because the post went back to draft.

    Only ever removes a row that has not started sending. A `sent` row
    stays: the messages are in people's inboxes and deleting the record of
    that would only make the next publish mail them all again. A `sending`
    row stays too — the run that owns it is mid-flight, and pulling the
    row out from under it is how you get a half-sent post with no memory
    of how far it got.

    Returns whether anything was cancelled.
    """
    from .models import PostEmail

    deleted, _ = PostEmail.objects.filter(
        post=post, status=PostEmail.Status.PENDING
    ).delete()
    return bool(deleted)


def build_post_message(post, subscriber: Subscriber):
    """One notification, addressed to one subscriber."""
    context = {
        "site_name": post.site.name,
        "post_title": post.title,
        "post_excerpt": post.excerpt,
        "post_url": post_url(post),
        "unsubscribe_url": unsubscribe_url(subscriber),
    }

    message = EmailMultiAlternatives(
        subject=render_to_string("blog/email/new_post_subject.txt", context).strip(),
        body=render_to_string("blog/email/new_post_message.txt", context),
        from_email=from_address(post.site),
        to=[subscriber.email],
        headers={
            # RFC 8058 one-click unsubscribe. Gmail and Yahoo require both
            # of these from bulk senders, and a mail client that
            # understands them puts an "Unsubscribe" control in its own
            # chrome — which is the difference between a reader who leaves
            # quietly and one who reaches for "report spam" because they
            # could not find the link. The POST endpoint these name has
            # existed since Phase 1 and takes its token from the query
            # string precisely so it can be used this way.
            "List-Unsubscribe": f"<{context['unsubscribe_url']}>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
    )
    message.attach_alternative(
        render_to_string("blog/email/new_post_message.html", context), "text/html"
    )
    return message


def remaining_quota_today(site) -> int:
    """
    How many more notification emails this blog may send today.

    A blast-radius bound, not a billing limit. One writer who imports a
    bought list, or whose account is taken over, can otherwise spend the
    whole platform's sending reputation in a single publish — and the
    damage lands on every other blog, because they all send from one
    domain. A cap turns "reputation destroyed" into "one blog's post went
    out over two days", which is recoverable.

    Counted from what was actually sent, not from what was scheduled, and
    over a calendar day in the project's timezone (UTC). Deliberately a
    live query rather than a counter column: a counter that drifts out of
    step after a crash is worse than useless here, because the direction it
    drifts decides whether the cap is enforced at all.
    """
    from .models import PostEmail

    start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

    sent_today = (
        PostEmail.objects.filter(
            post__site=site, created_at__gte=start
        ).aggregate(total=Sum("sent_count"))["total"]
        or 0
    )

    return max(0, settings.POST_EMAIL_DAILY_CAP_PER_SITE - sent_today)


def send_post_email(row, *, batch_size: int = BATCH_SIZE) -> int:
    """
    Mail one queued post to its blog's confirmed subscribers.

    Returns how many messages went out on this run. Assumes the caller has
    already claimed the row — see the management command, which flips it to
    `sending` with a conditional update so two crons cannot both pick it up.

    Subscribers are walked in primary-key order from `last_subscriber_id`,
    which is what lets an interrupted run resume. The queryset is
    re-evaluated per batch rather than materialised up front, so somebody
    who confirms while a long send is in progress is included — they
    subscribed before the post reached them, which is the only thing they
    could reasonably expect.

    One SMTP connection is opened for the whole run and reused. That is the
    entire performance story at this size: the handshake, not the message,
    is what costs, and doing it once instead of five hundred times is the
    difference between a send taking seconds and taking minutes.
    """
    from .models import PostEmail

    post = row.post
    sent = 0
    remaining = remaining_quota_today(post.site)

    if remaining <= 0:
        # Already at the cap. Left `pending` with its cursor untouched, so
        # the run that picks it up after midnight carries on from exactly
        # where this one would have started.
        logger.warning(
            "Daily cap reached for site %s; post email %s deferred",
            post.site.slug,
            row.pk,
        )
        row.status = PostEmail.Status.PENDING
        row.save(update_fields=["status"])
        return 0

    connection = get_connection()
    connection.open()

    try:
        while remaining > 0:
            batch = list(
                Subscriber.objects.filter(
                    site=post.site,
                    status=Subscriber.Status.CONFIRMED,
                    pk__gt=row.last_subscriber_id,
                )
                .order_by("pk")[: min(batch_size, remaining)]
            )
            if not batch:
                break

            messages = [build_post_message(post, s) for s in batch]
            connection.send_messages(messages)

            # Committed before the next batch is built, so a crash resumes
            # from here rather than from the beginning.
            sent += len(messages)
            remaining -= len(messages)
            row.last_subscriber_id = batch[-1].pk
            row.sent_count += len(messages)
            row.save(update_fields=["last_subscriber_id", "sent_count"])
    finally:
        # close() rather than leaving it to garbage collection: an SMTP
        # connection held open past the end of a cron run is a file
        # descriptor and a server-side session nobody is going to reclaim.
        connection.close()

    # Ran out of quota before running out of people: the row stays pending
    # so tomorrow finishes it, rather than being marked sent with half the
    # list never mailed.
    still_owed = Subscriber.objects.filter(
        site=post.site,
        status=Subscriber.Status.CONFIRMED,
        pk__gt=row.last_subscriber_id,
    ).exists()

    if still_owed:
        logger.warning(
            "Daily cap reached mid-send for site %s; post email %s will resume",
            post.site.slug,
            row.pk,
        )
        row.status = PostEmail.Status.PENDING
        row.save(update_fields=["status"])
        return sent

    row.status = PostEmail.Status.SENT
    row.sent_at = timezone.now()
    row.error = ""
    row.save(update_fields=["status", "sent_at", "error"])
    return sent
