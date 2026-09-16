import re
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
        while siblings.filter(slug=candidate).exists():
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
