"""
Serializers for the anonymous, read-only blog API.

These are deliberately separate classes rather than flags on the dashboard
serializers. The dashboard ones are written to be generous — they carry the
owning site's id, internal timestamps, an author lookup — and every field
added there in future would otherwise leak onto the public internet by
default. Here the field list is the whole security boundary, so it is short,
explicit, and read-only, and a test asserts what is *not* in it.

Never add to these: the owner's user id, `status`, `created_at`,
`updated_at`, or the site's primary key.

The one field that is *conditionally* public is the owner's email address,
and the rule for it is in PublicSiteSerializer.to_representation: the key is
removed unless the owner switched it on. Removed, not blanked — see there.
"""

from rest_framework import serializers

from .models import Post, Site, Subscriber
from .sanitize import clean


class PublicSiteSerializer(serializers.ModelSerializer):
    """
    What a reader is told about the blog, and about the person writing it.

    The four appearance fields are here because the blog cannot render
    without them, and they are safe to publish because none of them is a
    colour: `theme`, `appearance` and `font_pairing` are enum members the
    frontend maps onto values it owns, and `accent_hue` is an integer
    0-360. A reader learns which palette a writer picked, which is not a
    secret — it is the page they are looking at.

    The profile fields (`display_name`, `bio`, `avatar`) are always public:
    they exist for no other purpose than being read by strangers, and a
    writer fills them in knowing that. `email` is the exception, and it is
    handled in to_representation() below.

    `subscriptions_enabled` is here so the blog knows whether to draw a
    subscribe form. It says nothing about who has subscribed and reveals
    nothing a reader could not learn by looking at the page — which is
    exactly the test for whether a field belongs in this list.
    """

    # The writer's display name — never the account's id.
    display_name = serializers.CharField(source="owner.display_name", read_only=True)
    bio = serializers.CharField(source="owner.bio", read_only=True)
    # An absolute URL (DRF builds one from the request), or null when the
    # writer has not uploaded a picture — the blog draws an initials circle
    # in that case rather than shipping a default portrait.
    avatar = serializers.ImageField(source="owner.avatar", read_only=True)
    email = serializers.EmailField(source="owner.email", read_only=True)

    class Meta:
        model = Site
        fields = [
            "name",
            "slug",
            "tagline",
            "description",
            "display_name",
            "bio",
            "avatar",
            "email",
            "theme",
            "appearance",
            "font_pairing",
            "accent_hue",
            "subscriptions_enabled",
        ]
        read_only_fields = fields

    def to_representation(self, instance: Site) -> dict:
        """
        Drop `email` entirely unless the owner published it.

        Two decisions worth keeping:

        **The address never leaves the server when the switch is off.** The
        alternative — always serialize it and let the blog decide what to
        render — puts a private address in a public HTTP response and relies
        on the frontend's discretion. Anyone with `curl` has the address at
        that point, whatever the page shows. Popping it here means the only
        way to read it is to be the person who turned it on.

        **The key is removed, not set to null or "".** A `null` email is
        still a statement that the field exists and this writer has one
        hidden, and it invites a frontend to render an empty row or a
        "hidden" placeholder. An absent key has one possible rendering,
        which is nothing at all.
        """
        data = super().to_representation(instance)

        if not instance.owner.show_email_publicly:
            data.pop("email", None)

        return data


class PublicPostListSerializer(serializers.ModelSerializer):
    """One entry on the blog index."""

    read_time_minutes = serializers.IntegerField(read_only=True)

    class Meta:
        model = Post
        fields = [
            "title",
            "slug",
            "excerpt",
            "read_time_minutes",
            "published_at",
        ]
        read_only_fields = fields


class PublicPostSerializer(PublicPostListSerializer):
    """A single post, with its body. The author is repeated for the byline."""

    # The body is the only field here that came from a person rather than
    # from the database's own bookkeeping, and it is the only one rendered
    # as markup. See sanitize.py for why that is cleaned on the way out.
    content = serializers.SerializerMethodField()

    # Post.author is nulled rather than cascaded when an account closes, so
    # the byline has to survive its author disappearing. Without an explicit
    # default, DRF walks into `None.display_name` and drops the key.
    author = serializers.CharField(
        source="author.display_name", read_only=True, default=None
    )

    class Meta(PublicPostListSerializer.Meta):
        fields = [*PublicPostListSerializer.Meta.fields, "content", "author"]
        read_only_fields = fields

    def get_content(self, obj: Post) -> str:
        return clean(obj.content)


class SubscribeSerializer(serializers.Serializer):
    """
    What the subscribe form is allowed to say.

    A plain Serializer rather than a ModelSerializer, deliberately. A
    ModelSerializer over Subscriber would accept whatever fields it found
    there, and the two that matter — `site` and `status` — must come from
    the URL and from the confirmation flow respectively, never from the
    body. A reader who could post `{"status": "confirmed"}` would have
    skipped the entire opt-in.
    """

    email = serializers.EmailField(max_length=254)

    # Which form on the blog this came from. Bounded to the enum, so an
    # unknown value is a 400 rather than a free string in the database.
    source = serializers.ChoiceField(
        choices=Subscriber.Source.choices,
        required=False,
        default=Subscriber.Source.UNKNOWN,
    )

    # Honeypot. Hidden from people by CSS and from screen readers by
    # aria-hidden, so anything that fills it in is automated. The view
    # does not reject those submissions — it answers exactly as it would
    # have done and writes nothing, because a bot that is told it failed
    # is a bot that tries again differently.
    #
    # Named for what a form-filler expects to see rather than
    # "honeypot": the trap only works if it looks like a field.
    website = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_email(self, value: str) -> str:
        # Lowercased here as well as in Subscriber.save(), so the view can
        # look the row up by the same string the constraint stores.
        return Subscriber.normalize_email(value)


class SubscriptionSerializer(serializers.ModelSerializer):
    """
    A subscription described back to the person holding its token.

    Reachable only with the unsubscribe token or a valid confirmation
    signature, which is what makes it safe to include the address: the
    only way to ask is to already have had the email. The blog's name is
    here because an unsubscribe page that cannot say what it is
    unsubscribing you from is a page nobody should click the button on.
    """

    site_name = serializers.CharField(source="site.name", read_only=True)
    site_slug = serializers.CharField(source="site.slug", read_only=True)

    class Meta:
        model = Subscriber
        fields = ["email", "status", "site_name", "site_slug"]
        read_only_fields = fields
