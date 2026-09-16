"""
The anonymous, read-only half of the API — what the published blog reads.

Every view here is `AllowAny`, which is the opposite of the project default
(see REST_FRAMEWORK in settings: an endpoint that says nothing is private).
That is deliberate and it is the point of this module: these three URLs are
the only ones a reader with no Postly account ever touches, so keeping them
in one file makes the public surface something you can read end to end.

Three rules hold across all of them:

* only published posts exist — a draft is a 404, not a 403, so the public
  API never confirms that an unpublished post is there;
* the serializers come from public_serializers.py, which lists public fields
  explicitly rather than excluding private ones;
* nothing is scoped by `request.user`, because there is not one.
"""

from django.shortcuts import get_object_or_404
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny

from .models import Post, Site
from .public_serializers import (
    PublicPostListSerializer,
    PublicPostSerializer,
    PublicSiteSerializer,
)


def published_posts(site_slug: str):
    """
    Everything a reader of `site_slug` is allowed to see.

    The status filter lives here, once, rather than in each view — it is the
    single line standing between a draft and the internet.
    """
    site = get_object_or_404(Site, slug=site_slug)
    return (
        Post.objects.filter(site=site, status=Post.Status.PUBLISHED)
        .select_related("author")
        .order_by("-published_at", "-id")
    )


class PublicSiteView(RetrieveAPIView):
    """GET /api/public/sites/{slug}/ — the blog's name, description, author."""

    permission_classes = [AllowAny]
    serializer_class = PublicSiteSerializer
    queryset = Site.objects.select_related("owner")
    lookup_field = "slug"


class PublicPostListView(ListAPIView):
    """
    GET /api/public/sites/{slug}/posts/ — published posts, newest first.

    Paginated by the project default (PAGE_SIZE 20, `?page=`).
    """

    permission_classes = [AllowAny]
    serializer_class = PublicPostListSerializer
    # Neither filtering nor ordering is client-controllable here: a reader
    # choosing the ordering is not a feature, and `?status=` would be a way
    # to ask for drafts.
    filter_backends = []

    def get_queryset(self):
        return published_posts(self.kwargs["slug"])


class PublicPostDetailView(RetrieveAPIView):
    """
    GET /api/public/sites/{slug}/posts/{post_slug}/ — one published post.

    A draft's slug 404s here, which is what the frontend renders as
    "not found" rather than leaking that the post exists in someone's
    dashboard.
    """

    permission_classes = [AllowAny]
    serializer_class = PublicPostSerializer
    lookup_url_kwarg = "post_slug"
    lookup_field = "slug"

    def get_queryset(self):
        return published_posts(self.kwargs["slug"])
