from django.db.models import Count
from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from .filters import PostFilter
from .models import Post, Site
from .serializers import PostListSerializer, PostSerializer, SiteSerializer


class SiteViewSet(viewsets.ModelViewSet):
    """
    CRUD for blogs.

    TODO Phase 2: replace with IsAuthenticated, and narrow get_queryset() to
    Site.objects.filter(owner=self.request.user). Until then this endpoint
    exposes and mutates every site on the instance.
    """

    permission_classes = [AllowAny]
    serializer_class = SiteSerializer
    # order_by is explicit because annotate() discards Meta.ordering, which
    # would leave pagination non-deterministic.
    queryset = Site.objects.annotate(posts_count=Count("posts")).order_by("name")
    filterset_fields = ["slug"]
    ordering_fields = ["name", "created_at", "updated_at"]


class PostViewSet(viewsets.ModelViewSet):
    """
    CRUD for posts. PATCH doubles as the dashboard's autosave endpoint.

    TODO Phase 2: replace with IsAuthenticated, and narrow get_queryset() to
    Post.objects.filter(site__owner=self.request.user). Until then this
    endpoint exposes and mutates every post on the instance.
    """

    permission_classes = [AllowAny]
    queryset = Post.objects.select_related("site")
    filterset_class = PostFilter
    ordering_fields = ["updated_at", "created_at", "published_at", "title"]

    def get_serializer_class(self):
        # The list view drops `content`; everything else needs the full body.
        if self.action == "list":
            return PostListSerializer
        return PostSerializer
