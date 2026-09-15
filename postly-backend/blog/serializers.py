from rest_framework import serializers

from .models import Post, Site


class SiteSerializer(serializers.ModelSerializer):
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

    def get_posts_count(self, obj: Site) -> int:
        # SiteViewSet annotates this so a list costs one query; a freshly
        # created instance has no annotation, so fall back to counting.
        annotated = getattr(obj, "posts_count", None)
        return annotated if annotated is not None else obj.posts.count()


class PostSerializer(serializers.ModelSerializer):
    """Full representation, used for retrieve/create/update."""

    site_name = serializers.CharField(source="site.name", read_only=True)

    class Meta:
        model = Post
        fields = [
            "id",
            "site",
            "site_name",
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
        read_only_fields = [
            "id",
            "slug",
            "published_at",
            "created_at",
            "updated_at",
        ]

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
