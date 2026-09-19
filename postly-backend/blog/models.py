import re
import secrets
from math import ceil

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.html import strip_tags
from django.utils.text import Truncator, slugify

EXCERPT_LENGTH = 200

# Words a minute, for the read-time estimate shown in the dashboard and on
# published posts. 200 is the usual figure for adult silent reading of
# ordinary prose; the number only has to be defensible, not exact.
READING_WORDS_PER_MINUTE = 200

# Tags that imply a line break, so the text either side must not be glued
# together when the markup is stripped for an excerpt.
BLOCK_BOUNDARY_RE = re.compile(
    r"<\s*/?\s*(p|div|br|li|ul|ol|h[1-6]|blockquote|pre|tr|td|th|section)\b[^>]*>",
    re.IGNORECASE,
)
WHITESPACE_RE = re.compile(r"\s+")

# Post slugs the published blog needs for itself.
#
# A blog is served at /<site>/<post>, and the subscription pages sit at
# /<site>/subscription/... — a static segment, which the Next.js router
# matches ahead of the [postSlug] catch-all. A post that slugged to
# "subscription" would therefore be shadowed by them and unreachable, so
# _build_unique_slug() treats these as already taken and moves on to
# "subscription-2". The reader loses nothing; the writer's title is
# untouched either way.
#
# This is the per-post counterpart of RESERVED_SLUGS in subdomains.py,
# which reserves the *site* slugs Postly's own top-level routes need.
RESERVED_POST_SLUGS = frozenset({"subscription"})


class Site(models.Model):
    """
    One writer's blog. This is the tenant boundary for everything else:
    every queryset in the API is filtered by `owner`.
    """

    class Theme(models.TextChoices):
        """
        A named palette. The values live in the frontend
        (`src/lib/blog-theme.ts`), which is the only thing that can render
        them; this column only has to say *which* one, so the database never
        holds a colour and the API never accepts one.
        """

        PAPER = "paper", "Paper"
        SLATE = "slate", "Slate"
        SEPIA = "sepia", "Sepia"
        MONO = "mono", "Mono"

    class Appearance(models.TextChoices):
        LIGHT = "light", "Light"
        DARK = "dark", "Dark"
        # Renders light, with a prefers-color-scheme override for dark. The
        # writer is choosing to let the reader decide.
        SYSTEM = "system", "Follow the reader"

    class FontPairing(models.TextChoices):
        EDITORIAL = "editorial", "Editorial — serif headings, serif body"
        CLEAN = "clean", "Clean — serif headings, sans body"
        PLAIN = "plain", "Plain — sans headings, sans body"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="sites",
        on_delete=models.CASCADE,
        help_text="Deleting the account deletes the blog and its posts.",
    )
    name = models.CharField(max_length=120, help_text="The blog's display title.")
    slug = models.SlugField(
        max_length=63,  # a DNS label may not exceed 63 characters
        unique=True,
        help_text="Becomes the subdomain: <slug>.postly.com",
    )
    tagline = models.CharField(
        max_length=160,
        blank=True,
        help_text="One line under the blog's name in the masthead. A "
        "subtitle, not a description — the long version is `description`.",
    )
    description = models.TextField(blank=True)

    # --- Appearance ---------------------------------------------------------
    # Four columns, all of them closed sets or a bounded number. No column
    # here holds a colour, a font name, or any other string that ends up
    # inside a stylesheet: the frontend maps these onto values it owns. That
    # is what stops a blog's theme from being a CSS injection vector.
    theme = models.CharField(
        max_length=16,
        choices=Theme.choices,
        default=Theme.PAPER,
        help_text="Which named palette the published blog is rendered in.",
    )
    appearance = models.CharField(
        max_length=16,
        choices=Appearance.choices,
        default=Appearance.LIGHT,
        help_text="Light, dark, or whichever the reader's system asks for.",
    )
    font_pairing = models.CharField(
        max_length=16,
        choices=FontPairing.choices,
        default=FontPairing.EDITORIAL,
        help_text="Which of the loaded font families the blog sets type in.",
    )
    accent_hue = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(360)],
        help_text="An OKLCH hue, 0-360, for links and accents. Null keeps the "
        "theme's own accent. Only the hue is the writer's to choose — "
        "lightness and chroma come from the theme, which is what keeps "
        "contrast legible at every setting.",
    )

    # --- Subscriptions ------------------------------------------------------
    # Off until the writer asks for it. A blog that has never opted in has no
    # subscribe form and no subscribe endpoint: the public view 404s on a site
    # with this false, so switching it off later stops new sign-ups at the API
    # rather than merely hiding the form. Existing subscribers are untouched —
    # this governs intake, not the list.
    subscriptions_enabled = models.BooleanField(
        default=False,
        help_text="Whether readers are offered an email subscription.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    @property
    def domain(self) -> str:
        """The address this blog will be served from once routing exists."""
        return f"{self.slug}.postly.com"


class Post(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

    site = models.ForeignKey(Site, related_name="posts", on_delete=models.CASCADE)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="posts",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Nulled rather than cascaded, so closing an account does "
        "not unpublish what it wrote.",
    )
    title = models.CharField(max_length=255)
    slug = models.SlugField(
        max_length=255,
        blank=True,
        help_text="Generated from the title on first save, then left alone so "
        "published URLs stay stable.",
    )
    content = models.TextField(blank=True, help_text="HTML produced by the editor.")
    excerpt = models.CharField(max_length=300, blank=True)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.DRAFT
    )
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["site", "slug"], name="unique_post_slug_per_site"
            )
        ]
        indexes = [models.Index(fields=["site", "status"])]

    def __str__(self) -> str:
        return self.title or "(untitled)"

    @property
    def is_published(self) -> bool:
        return self.status == self.Status.PUBLISHED

    def _build_unique_slug(self) -> str:
        """Slugify the title, then suffix -2, -3... until it is free on this site."""
        base = slugify(self.title)[:200] or "untitled"
        siblings = Post.objects.filter(site=self.site)
        if self.pk:
            siblings = siblings.exclude(pk=self.pk)

        candidate, suffix = base, 2
        # A reserved slug is treated exactly like one already in use: the
        # blog's own routes claim it, so a post there would be unreachable.
        while candidate in RESERVED_POST_SLUGS or siblings.filter(slug=candidate).exists():
            candidate = f"{base}-{suffix}"
            suffix += 1
        return candidate

    @property
    def plain_text(self) -> str:
        """The body with the editor's HTML removed, for excerpts and counting."""
        # Block boundaries have to become whitespace first, or the end of one
        # paragraph runs into the start of the next: "...twice.What I got...".
        # Inline tags are left to strip_tags so "<strong>word</strong>," does
        # not gain a space before the comma.
        text = BLOCK_BOUNDARY_RE.sub(" ", self.content or "")
        text = strip_tags(text).replace("&nbsp;", " ")
        return WHITESPACE_RE.sub(" ", text).strip()

    @property
    def word_count(self) -> int:
        text = self.plain_text
        return len(text.split()) if text else 0

    @property
    def read_time_minutes(self) -> int:
        """
        Minutes, rounded up, never zero.

        A two-line post is "1 min read" rather than "0 min read", which reads
        as an error rather than as a very short post.
        """
        return max(1, ceil(self.word_count / READING_WORDS_PER_MINUTE))

    def _build_excerpt(self) -> str:
        """First couple of sentences of the body, with the editor's HTML removed."""
        return Truncator(self.plain_text).chars(EXCERPT_LENGTH, truncate="…")

    def save(self, *args, **kwargs):
        touched = []

        if not self.slug:
            self.slug = self._build_unique_slug()
            touched.append("slug")

        if not self.excerpt:
            self.excerpt = self._build_excerpt()
            touched.append("excerpt")

        # published_at always describes the *current* publication, so it is set
        # on the way up and cleared on the way back down to draft.
        if self.is_published and self.published_at is None:
            self.published_at = timezone.now()
            touched.append("published_at")
        elif not self.is_published and self.published_at is not None:
            self.published_at = None
            touched.append("published_at")

        # A caller passing update_fields would otherwise silently drop the
        # fields this method just derived.
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and touched:
            kwargs["update_fields"] = set(update_fields) | set(touched)

        super().save(*args, **kwargs)


class Subscriber(models.Model):
    """
    One reader who asked to hear when a blog publishes.

    Scoped to a Site, not to a User: subscribers have no Postly account and
    never will, and the same address subscribing to two blogs is two rows.
    Site is the tenant boundary everywhere else in this file, and it is the
    tenant boundary here — a writer can only ever see, export or mail the
    rows whose `site` they own.

    ## Nothing here is a mailing list until it says `confirmed`

    A row is created in `pending` and stays there until the person follows
    the link in a confirmation email. That is not politeness, it is the
    thing that keeps Postly able to send mail at all:

    * **Anyone can type anyone's address into a public form.** Without a
      confirmation step the form is a way to subscribe a stranger, and the
      stranger's only signal is to press "spam".
    * **Every blog on Postly shares one sending reputation.** One writer's
      unconfirmed list earning complaints degrades delivery for every other
      writer — and, on a shared domain, for password-reset mail too.
    * **GDPR treats consent as something you have to be able to show.**
      `confirmed_at` is that record.

    So the send path filters on `status=confirmed` and nothing else, and
    there is deliberately no bulk-import path into this table.

    ## Two tokens, and why they are different kinds of thing

    `unsubscribe_token` is a stored random string, because it has to work
    for as long as the subscription does — an unsubscribe link in a
    two-year-old email must still unsubscribe. Being a column means it can
    also be rotated or revoked, which a signature cannot.

    The confirmation token is the opposite — short-lived and single-purpose
    — so it is not here at all: it is an expiring signature over the row's
    id and address, minted and checked in subscriptions.py. Nothing to
    store, nothing to clean up, and no window in which a leaked database
    column is a working confirm link.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending confirmation"
        CONFIRMED = "confirmed", "Confirmed"
        UNSUBSCRIBED = "unsubscribed", "Unsubscribed"
        # The last two are set by the provider webhook, never by a person,
        # and they are three separate states rather than one "inactive"
        # because they mean genuinely different things:
        #
        # * `unsubscribed` is a decision — somebody clicked the link;
        # * `bounced` is a dead address — nobody decided anything, and the
        #   mail had nowhere to go;
        # * `complained` is somebody pressing "report spam", which is the
        #   most expensive event in the whole system. Mailbox providers
        #   measure it as a rate, and above roughly 0.3% they start
        #   filtering everything from the sending domain — which on a
        #   multi-tenant platform means every other blog's posts, and
        #   Postly's own password-reset mail.
        #
        # Collapsing them would make that rate impossible to measure, which
        # is the one number worth watching here.
        BOUNCED = "bounced", "Bounced"
        COMPLAINED = "complained", "Reported as spam"

    class Source(models.TextChoices):
        """Where on the blog the form was. Useful only for the writer's
        own curiosity, so the set is small and closed."""

        INDEX = "index", "Blog index"
        POST = "post", "End of a post"
        UNKNOWN = "unknown", "Unknown"

    site = models.ForeignKey(
        Site,
        related_name="subscribers",
        on_delete=models.CASCADE,
        help_text="Deleting the blog deletes its list.",
    )
    # 254 is the maximum length of an address per RFC 5321; Django's default
    # of 254 is already that, and it is spelled out here because the unique
    # constraint below depends on it not being truncated.
    email = models.EmailField(max_length=254)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING
    )
    unsubscribe_token = models.CharField(
        max_length=64,
        unique=True,
        editable=False,
        help_text="Unguessable, permanent, and enough on its own to "
        "unsubscribe — an unsubscribe link cannot ask a reader to log in.",
    )
    source = models.CharField(
        max_length=16, choices=Source.choices, default=Source.UNKNOWN
    )

    created_at = models.DateTimeField(auto_now_add=True)
    # Set only when a confirmation message actually went out, never when one
    # was attempted and failed. blog/emails.py uses it as a per-address
    # cooldown: the throttle on the subscribe endpoint is per *IP*, which
    # bounds how fast one machine can submit but not how much mail a
    # distributed set of them can aim at a single inbox. This is the other
    # half of that control, and it is the reason the subscribe form cannot
    # be turned into a way of flooding somebody's mailbox.
    confirmation_sent_at = models.DateTimeField(null=True, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    unsubscribed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            # One row per address per blog. Subscribing twice has to be the
            # same subscription rather than a second copy, or a reader who
            # forgets they signed up gets two of every email and one
            # unsubscribe link that only fixes half of it.
            models.UniqueConstraint(
                fields=["site", "email"], name="unique_subscriber_per_site"
            )
        ]
        indexes = [
            # The send path's only query: confirmed subscribers of one site.
            models.Index(fields=["site", "status"]),
        ]

    def __str__(self) -> str:
        # ASCII: this gets printed in shells, and a Windows console is
        # cp1252, where a non-ASCII character raises rather than prints.
        return f"{self.email} -> {self.site.slug}"

    @property
    def is_active(self) -> bool:
        """Whether a new post should be mailed to this row."""
        return self.status == self.Status.CONFIRMED

    @staticmethod
    def normalize_email(value: str) -> str:
        """
        Lowercase and strip, so one person is one row.

        The domain half of an address is case-insensitive by specification;
        the local half technically is not, but no mail provider in real use
        distinguishes `Ada@` from `ada@`, and treating them as two rows
        means sending that person two copies of every post and giving them
        an unsubscribe link that silences only one. Lowercasing the whole
        address is what makes the unique constraint above mean what it
        looks like it means.
        """
        return (value or "").strip().lower()

    @staticmethod
    def new_unsubscribe_token() -> str:
        """43 URL-safe characters over 32 bytes of entropy."""
        return secrets.token_urlsafe(32)

    def save(self, *args, **kwargs):
        touched = []

        normalized = self.normalize_email(self.email)
        if normalized != self.email:
            self.email = normalized
            touched.append("email")

        if not self.unsubscribe_token:
            self.unsubscribe_token = self.new_unsubscribe_token()
            touched.append("unsubscribe_token")

        # As in Post.save(): a caller passing update_fields would otherwise
        # silently drop whatever this method just derived.
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and touched:
            kwargs["update_fields"] = set(update_fields) | set(touched)

        super().save(*args, **kwargs)


class PostEmail(models.Model):
    """
    One post's notification to its blog's subscribers: an outbox row.

    Nothing is mailed from inside the request that publishes a post. This
    row is written instead, and `manage.py send_pending_post_emails` — run
    on a cron — drains it. Three reasons that indirection is worth a table:

    * **A publish must not wait on five hundred SMTP round trips**, nor fail
      because the mail server is briefly unreachable. The writer's action is
      "publish", and it should succeed or fail on its own terms.
    * **A crash must not lose the send, or repeat it.** A row that says what
      is owed and how far it got survives a restart; an in-request loop does
      not.
    * **It is the seam a queue slots into later.** Moving to Celery replaces
      who calls the sender, not this model and not the sending code.

    ## The one-to-one is the whole idempotency story

    `post` is a OneToOneField, so a post can have at most one of these, ever.
    Publish → unpublish → republish cannot produce a second send: the row
    from the first publish is still there. A row that has not gone out yet is
    deleted on unpublish (see cancel_post_email), so that sequence reschedules
    rather than duplicating; a row that has already sent is left alone,
    because the mail is in people's inboxes and there is nothing to undo.

    ## The cursor, and what it does not promise

    `last_subscriber_id` advances after each committed batch, so a crashed
    run resumes near where it stopped instead of starting over and mailing
    the first several hundred people twice.

    It is a batch-level guarantee, not a per-recipient one: a process that
    dies midway through a batch can, on retry, re-send to at most one
    batch's worth of people. Closing that last gap needs a row per
    recipient, which is a real cost per post per subscriber, and the thing
    it buys — never a duplicate, rather than at most BATCH_SIZE of them
    after a hard crash — is not worth that at this size. Phase 5's delivery
    stats are where per-recipient rows earn their keep, and this column
    becomes redundant then.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Waiting to send"
        SENDING = "sending", "Sending"
        SENT = "sent", "Sent"
        # Out of attempts. Never retried automatically again; a person has
        # to look at `error` and decide.
        FAILED = "failed", "Failed"

    post = models.OneToOneField(
        Post,
        related_name="email",
        on_delete=models.CASCADE,
        help_text="One notification per post, forever. This is what makes "
        "republishing unable to mail anybody twice.",
    )
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING
    )
    scheduled_for = models.DateTimeField(
        help_text="Not before this. The gap between publishing and sending "
        "is the window in which a writer can unpublish a typo and have "
        "nothing go out.",
    )

    last_subscriber_id = models.PositiveBigIntegerField(
        default=0,
        help_text="Highest subscriber id already mailed. A resumed run "
        "starts after this rather than at the beginning.",
    )
    recipient_count = models.PositiveIntegerField(
        default=0, help_text="Confirmed subscribers when the run started."
    )
    sent_count = models.PositiveIntegerField(default=0)
    attempts = models.PositiveSmallIntegerField(default=0)
    error = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            # The command's only query: what is due.
            models.Index(fields=["status", "scheduled_for"]),
        ]

    def __str__(self) -> str:
        return f"{self.post_id} -> {self.get_status_display().lower()}"

    @property
    def is_due(self) -> bool:
        return (
            self.status == self.Status.PENDING and self.scheduled_for <= timezone.now()
        )
