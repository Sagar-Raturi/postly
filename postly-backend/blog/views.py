import csv

from django.db.models import Count
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import IsOwner

from .csv_safety import csv_safe
from .filters import PostFilter, SubscriberFilter
from .models import Post, Site, Subscriber
from .serializers import (
    PostListSerializer,
    PostSerializer,
    SiteSerializer,
    SubscriberSerializer,
)


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


class SubscriberViewSet(viewsets.ReadOnlyModelViewSet):
    """
    The writer's own mailing list: who is on it, and a copy to take away.

    Read-only. A writer can look at their list, count it and export it, and
    cannot edit a row — because every column here is a record of something
    a *reader* did. Being able to set somebody's status to "confirmed" by
    hand would be manufacturing consent nobody gave, and `confirmed_at`
    would then be a timestamp for an event that never happened. Those
    columns are the evidence that the list is opt-in; they are written by
    the endpoints in public_views.py and by the provider webhook, and by
    nothing else.

    Removing somebody at their request, by some other channel, is a real
    need and is deliberately not solved by a DELETE here — a deleted row is
    one the next form submission silently re-adds. It wants an action that
    unsubscribes on their behalf and leaves the standing instruction in
    place. Not in this phase.
    """

    permission_classes = [IsAuthenticated, IsOwner]
    owner_lookup = "site.owner"
    serializer_class = SubscriberSerializer
    filterset_class = SubscriberFilter
    ordering_fields = ["created_at", "confirmed_at", "email", "status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        # Filtered by owner here, not only in IsOwner: an object-level check
        # alone would still let the list endpoint return every row on the
        # platform. This is the line that makes one writer's list invisible
        # to every other writer.
        return Subscriber.objects.filter(
            site__owner=self.request.user
        ).select_related("site")

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """
        GET /api/subscribers/stats/ — counts by status, for the dashboard.

        One grouped query rather than five counts, and `?site=` narrows it
        through the same filterset the list uses, so the numbers and the
        rows below them can never disagree about what they are describing.

        Every status is present in the response even at zero. A dashboard
        that renders whatever keys it happens to receive would silently drop
        a tile when a count hit zero, which reads as a bug in the page.
        """
        counts = dict(
            self.filter_queryset(self.get_queryset())
            # order_by() with no arguments, and it is load-bearing rather
            # than tidy-minded. Django puts every ordering field into the
            # GROUP BY of an aggregate — both the model's Meta.ordering and
            # whatever OrderingFilter just applied — so grouping by
            # `status` while ordered by `created_at` groups by
            # (status, created_at), which is one group per row. The counts
            # come back as a list of ones and dict() silently keeps the
            # last of each, so the numbers are wrong rather than absent.
            .order_by()
            .values_list("status")
            .annotate(total=Count("id"))
        )

        by_status = {
            value: counts.get(value, 0) for value, _ in Subscriber.Status.choices
        }

        return Response(
            {
                **by_status,
                "total": sum(by_status.values()),
                # The only number that answers "how many people will get my
                # next post", which is the question the page exists for.
                "active": by_status[Subscriber.Status.CONFIRMED],
            }
        )

    @action(detail=False, methods=["get"])
    def export(self, request):
        """
        GET /api/subscribers/export/ — the list as CSV.

        The writer's own data, so every status is included rather than only
        the confirmed ones: a list with the unsubscribes silently dropped is
        one that, re-imported anywhere, mails people who asked to leave.
        The `status` column is what makes that visible.

        Honours the same filters as the list endpoint, so "export what I am
        looking at" works.
        """
        rows = self.filter_queryset(self.get_queryset())

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = (
            f'attachment; filename="postly-subscribers-'
            f'{timezone.now():%Y-%m-%d}.csv"'
        )

        writer = csv.writer(response)
        writer.writerow(
            ["email", "status", "source", "subscribed_at", "confirmed_at", "left_at"]
        )

        for row in rows.iterator(chunk_size=500):
            writer.writerow(
                csv_safe(value)
                for value in (
                    row.email,
                    row.status,
                    row.source,
                    _iso(row.created_at),
                    _iso(row.confirmed_at),
                    _iso(row.unsubscribed_at),
                )
            )

        return response


def _iso(value) -> str:
    return value.isoformat() if value else ""
