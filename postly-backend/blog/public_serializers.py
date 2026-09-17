"""
Serializers for the anonymous, read-only blog API.

These are deliberately separate classes rather than flags on the dashboard
serializers. The dashboard ones are written to be generous — they carry the
owning site's id, internal timestamps, an author lookup — and every field
added there in future would otherwise leak onto the public internet by
default. Here the field list is the whole security boundary, so it is short,
explicit, and read-only, and a test asserts what is *not* in it.

Never add to these: the owner's email or user id, `status`, `created_at`,
`updated_at`, or the site's primary key.
"""

from rest_framework import serializers

from .models import Post, Site
from .sanitize import clean


class PublicSiteSerializer(serializers.ModelSerializer):
    """
    What a reader is told about the blog itself.

    The four appearance fields are here because the blog cannot render
    without them, and they are safe to publish because none of them is a
    colour: `theme`, `appearance` and `font_pairing` are enum members the
    frontend maps onto values it owns, and `accent_hue` is an integer
    0-360. A reader learns which palette a writer picked, which is not a
    secret — it is the page they are looking at.
    """

    # The writer's display name — never the account's email or id.
    author = serializers.CharField(source="owner.display_name", read_only=True)

    # A picture the writer chose in order to publish it, so it belongs on
    # the public surface in a way an email address never would. Null when
    # they have not set one, which the blog renders as initials.
    author_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Site
        fields = [
            "name",
            "slug",
            "description",
            "author",
            "author_avatar",
            "theme",
            "appearance",
            "font_pairing",
            "accent_hue",
        ]
        read_only_fields = fields

    def get_author_avatar(self, obj: Site) -> str | None:
        """
        An absolute URL, because the reader's page is served by Next.js on
        a different origin to the media files. A relative "/media/..." here
        would resolve against the blog's own host and 404.
        """
        avatar = obj.owner.avatar if obj.owner_id else None
        if not avatar:
            return None

        request = self.context.get("request")
        return request.build_absolute_uri(avatar.url) if request else avatar.url


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
