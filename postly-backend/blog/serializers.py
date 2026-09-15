from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Post, Site
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
            "description",
            "domain",
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

    def get_posts_count(self, obj: Site) -> int:
        # SiteViewSet annotates this so a list costs one query; a freshly
        # created instance has no annotation, so fall back to counting.
        annotated = getattr(obj, "posts_count", None)
        return annotated if annotated is not None else obj.posts.count()


class PostSerializer(serializers.ModelSerializer):
    """Full representation, used for retrieve/create/update."""

    site_name = serializers.CharField(source="site.name", read_only=True)
    author_name = serializers.CharField(source="author.display_name", read_only=True)

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
            "status",
            "published_at",
            "created_at",
            "updated_at",
        ]
        # slug and published_at are derived in Post.save(), never client-set.
        # author comes from the session in perform_create().
        read_only_fields = [
            "id",
            "slug",
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


class PostListSerializer(serializers.ModelSerializer):
    """
    Lighter representation for the list endpoint.

    Deliberately omits `content`: the dashboard list only renders titles and
    metadata, and twenty posts' worth of editor HTML is a lot to send for that.
    """

    class Meta:
        model = Post
        fields = [
            "id",
            "site",
            "title",
            "slug",
            "excerpt",
            "status",
            "published_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
