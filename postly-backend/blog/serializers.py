from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .emails import cancel_post_email, schedule_post_email
from .models import Post, PostEmail, Site, Subscriber
from .subdomains import clean_subdomain


class SiteSerializer(serializers.ModelSerializer):
    # `owner` is absent from `fields` on purpose: it is set from the session
    # in the viewset's perform_create(), never accepted from the body.
    posts_count = serializers.SerializerMethodField()
    domain = serializers.CharField(read_only=True)

    class Meta:
        model = Site
        fields = [
            "id",
            "name",
            "slug",
            "tagline",
            "description",
            "domain",
            "theme",
            "appearance",
            "font_pairing",
            "accent_hue",
            # Writable: this is the switch that offers readers a
            # subscription at all. Without it here, the column added in
            # Phase 1 would be reachable only from the Django admin.
            "subscriptions_enabled",
            "posts_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_slug(self, value: str) -> str:
        # The slug is published as a hostname, so DNS rules apply on top of
        # SlugField's looser ones.
        try:
            return clean_subdomain(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc

    def validate_accent_hue(self, value):
        """
        A hue, or nothing.

        The field is a PositiveSmallIntegerField with model validators, and
        DRF does not run those, so the bound is restated here — this value is
        formatted into a stylesheet on the public blog, and the fact that it
        can only ever be an integer 0-360 is what makes that safe.
        """
        if value is None:
            return None
        if not 0 <= value <= 360:
            raise serializers.ValidationError("Use a hue between 0 and 360.")
        return value

    def get_posts_count(self, obj: Site) -> int:
        # SiteViewSet annotates this so a list costs one query; a freshly
        # created instance has no annotation, so fall back to counting.
        annotated = getattr(obj, "posts_count", None)
        return annotated if annotated is not None else obj.posts.count()


class PostEmailSummarySerializer(serializers.ModelSerializer):
    """
    What became of a post's notification, for the writer who published it.

    A summary rather than the row: `last_subscriber_id` is internal
    bookkeeping and `error` is a Python exception string, which is the right
    thing to put in a log and the wrong thing to put in front of somebody
    who wants to know whether their post went out.

    `status` carries that instead, and the four values are honest about the
    four situations — still waiting, going out now, done, and gave up.
    """

    class Meta:
        model = PostEmail
        fields = ["status", "scheduled_for", "sent_count", "sent_at"]
        read_only_fields = fields


class PostSerializer(serializers.ModelSerializer):
    """Full representation, used for retrieve/create/update."""

    site_name = serializers.CharField(source="site.name", read_only=True)
    author_name = serializers.CharField(source="author.display_name", read_only=True)
    read_time_minutes = serializers.IntegerField(read_only=True)

    # Denormalised onto the post so the editor can decide whether to offer
    # the "email subscribers" checkbox without a second request for the
    # site. Read-only here — the switch itself lives on SiteSerializer.
    site_subscriptions_enabled = serializers.BooleanField(
        source="site.subscriptions_enabled", read_only=True
    )

    # Null until the post is published on a blog with subscriptions on, and
    # null forever if the writer unticked "email subscribers". The editor
    # renders nothing in that case rather than an empty panel.
    email_delivery = PostEmailSummarySerializer(source="email", read_only=True)

    class Meta:
        model = Post
        fields = [
            "id",
            "site",
            "site_name",
            "author_name",
            "title",
            "slug",
            "content",
            "excerpt",
            "read_time_minutes",
            "status",
            "published_at",
            "created_at",
            "updated_at",
            "site_subscriptions_enabled",
            "email_delivery",
            # Write-only, so it is accepted on the way in and never appears
            # in a response. See the block above create().
            "notify_subscribers",
        ]
        # slug and published_at are derived in Post.save(), never client-set.
        # author comes from the session in perform_create().
        read_only_fields = [
            "id",
            "slug",
            "read_time_minutes",
            "published_at",
            "created_at",
            "updated_at",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Without this, `site` accepts any primary key on the instance, and a
        # writer could file a post on somebody else's blog: the object-level
        # check cannot help, because the post does not exist yet and the site
        # it names is not theirs to be checked against.
        request = self.context.get("request")
        if request is not None and request.user.is_authenticated:
            self.fields["site"].queryset = Site.objects.filter(owner=request.user)

    def validate_title(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError("A post needs a title.")
        return value.strip()

    # ------------------------------------------------------------------ #
    # Notifying subscribers
    #
    # The trigger is the *transition* draft → published, not the value of
    # `status`. That distinction is the whole thing: PATCH is also the
    # dashboard's autosave endpoint, so a post that is already published
    # gets `status: "published"` sent with it every few seconds. Acting on
    # the value would mail the blog's subscribers once per keystroke.
    #
    # It lives here rather than in Post.save() deliberately. That method
    # already derives the slug, the excerpt and published_at, and burying
    # a queue write in it would mean every fixture, every seed command and
    # every test that publishes a post also queued mail. A serializer is
    # the layer where "somebody asked for this" is actually known.
    # ------------------------------------------------------------------ #

    notify_subscribers = serializers.BooleanField(
        write_only=True,
        required=False,
        default=True,
        help_text="Whether publishing this post should mail the blog's "
        "subscribers. Ignored unless this request publishes it.",
    )

    def create(self, validated_data):
        notify = validated_data.pop("notify_subscribers", True)
        post = super().create(validated_data)

        # A post can be created already published — "publish" on a post
        # that was never saved as a draft.
        if post.is_published and notify:
            schedule_post_email(post)

        return post

    def update(self, instance, validated_data):
        notify = validated_data.pop("notify_subscribers", True)
        was_published = instance.is_published

        post = super().update(instance, validated_data)

        if post.is_published and not was_published:
            if notify:
                schedule_post_email(post)
        elif was_published and not post.is_published:
            # Back to draft inside the delay window: drop the queued row so
            # nothing goes out. Does nothing once the mail has been sent,
            # which is the point of there being a window at all.
            cancel_post_email(post)

        return post


class PostListSerializer(serializers.ModelSerializer):
    """
    Lighter representation for the list endpoint.

    This used to omit `content` — twenty posts' worth of editor HTML is a
    lot to send to render a row of titles. The dashboard no longer renders a
    row of titles: each card carries an excerpt, expands in place to show the
    full post, and the search box filters on body text as well as titles.
    All three want the body, and fetching it per card on expand would trade
    one predictable request for an unpredictable number of small ones.

    The cost is bounded by pagination (PAGE_SIZE 20), and what is omitted
    now is the things a list has no use for: `site_name` and `author_name`
    are the same on every row for a single writer's blog.

    `read_time_minutes` is computed server-side so the dashboard and the
    published post always agree on the number.
    """

    read_time_minutes = serializers.IntegerField(read_only=True)

    class Meta:
        model = Post
        fields = [
            "id",
            "site",
            "title",
            "slug",
            "content",
            "excerpt",
            "read_time_minutes",
            "status",
            "published_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class SubscriberSerializer(serializers.ModelSerializer):
    """
    One subscriber, as the writer who owns the list sees them.

    **`unsubscribe_token` is not here and must never be.** It is a working
    credential: anybody holding it can end that subscription without being
    logged in as anyone, which is exactly what an unsubscribe link in a
    two-year-old email has to be able to do. Putting it in a list endpoint
    would publish one per row, and putting it in the CSV export would write
    them all to a file that gets emailed around.

    That is also why this lists its fields rather than using `exclude`: a
    column added to Subscriber later must not appear here by default.
    """

    class Meta:
        model = Subscriber
        fields = [
            "id",
            "site",
            "email",
            "status",
            "source",
            "created_at",
            "confirmed_at",
            "unsubscribed_at",
        ]
        read_only_fields = fields
