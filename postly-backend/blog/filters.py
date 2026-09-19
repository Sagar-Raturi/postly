import django_filters

from .models import Post, Subscriber


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


class SubscriberFilter(django_filters.FilterSet):
    """Backs ?site={id}, ?status= and ?search= on /api/subscribers/."""

    site = django_filters.NumberFilter(field_name="site_id")
    status = django_filters.ChoiceFilter(choices=Subscriber.Status.choices)
    # Address only. There is nothing else on a subscriber a writer could
    # reasonably search, and the column is small enough that icontains
    # without an index is not a problem at these sizes.
    search = django_filters.CharFilter(
        field_name="email", lookup_expr="icontains", label="Address contains"
    )

    class Meta:
        model = Subscriber
        fields = ["site", "status", "search"]
