from django.db.models import Count
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import IsOwner

from .filters import PostFilter
from .models import Post, Site
from .serializers import PostListSerializer, PostSerializer, SiteSerializer


class SiteViewSet(viewsets.ModelViewSet):
    """CRUD for the requesting user's blogs."""

    # IsAuthenticated is restated because permission_classes *replaces* the
    # project default rather than adding to it — listing IsOwner alone would
    # let anonymous callers through to get_queryset().
    permission_classes = [IsAuthenticated, IsOwner]
    serializer_class = SiteSerializer
    owner_lookup = "owner"
    filterset_fields = ["slug"]
    ordering_fields = ["name", "created_at", "updated_at"]

    def get_queryset(self):
        # Filtering here, not only in IsOwner, is what makes another
        # account's blog a 404: an object-level check alone would still let
        # the list endpoint return every row.
        return (
            Site.objects.filter(owner=self.request.user)
            # order_by is explicit because annotate() discards Meta.ordering,
            # which would leave pagination non-deterministic.
            .annotate(posts_count=Count("posts")).order_by("name")
        )

    def perform_create(self, serializer):
        # From the session, never from the request body — otherwise a caller
        # could create a blog owned by somebody else.
        serializer.save(owner=self.request.user)


class PostViewSet(viewsets.ModelViewSet):
    """
    CRUD for posts on the requesting user's blogs. PATCH doubles as the
    dashboard's autosave endpoint.
    """

    permission_classes = [IsAuthenticated, IsOwner]
    owner_lookup = "site.owner"
    filterset_class = PostFilter
    ordering_fields = ["updated_at", "created_at", "published_at", "title"]

    def get_queryset(self):
        return Post.objects.filter(site__owner=self.request.user).select_related(
            "site", "author"
        )

    def get_serializer_class(self):
        # The list view drops `content`; everything else needs the full body.
        if self.action == "list":
            return PostListSerializer
        return PostSerializer

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
