import django_filters

from .models import Post


class PostFilter(django_filters.FilterSet):
    """Backs ?site={id} and ?status={draft|published} on /api/posts/."""

    site = django_filters.NumberFilter(field_name="site_id")
    status = django_filters.ChoiceFilter(choices=Post.Status.choices)
    search = django_filters.CharFilter(
        field_name="title", lookup_expr="icontains", label="Title contains"
    )

    class Meta:
        model = Post
        fields = ["site", "status", "search"]
