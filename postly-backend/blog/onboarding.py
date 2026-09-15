"""
The two endpoints behind the Next.js /onboarding screen.

Kept apart from views.py because these are not CRUD: one is a guarded
create-once, the other answers a question about a slug without creating
anything.
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.generics import CreateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Site
from .serializers import SiteSerializer
from .subdomains import clean_subdomain


class OnboardingSiteView(CreateAPIView):
    """POST /api/onboarding/site/ — the blog a new account starts with."""

    serializer_class = SiteSerializer
    permission_classes = [IsAuthenticated]
    throttle_scope = "onboarding"

    def create(self, request, *args, **kwargs):
        if Site.objects.filter(owner=request.user).exists():
            # The frontend routes people away from /onboarding once they have
            # a blog; this covers a stale tab that did not get the message.
            return Response(
                {"detail": "You already have a blog."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class SlugAvailabilityView(APIView):
    """
    GET /api/onboarding/slug-available/?slug=

    Backs the live check under the subdomain field. Authenticated and
    throttled, so it is not an open oracle for listing taken addresses.
    """

    permission_classes = [IsAuthenticated]
    throttle_scope = "onboarding"

    def get(self, request):
        raw = request.query_params.get("slug", "")

        try:
            slug = clean_subdomain(raw)
        except DjangoValidationError as exc:
            return Response(
                {"slug": raw, "available": False, "reason": exc.messages[0]}
            )

        if Site.objects.filter(slug=slug).exists():
            return Response(
                {"slug": slug, "available": False, "reason": "That address is taken."}
            )

        return Response({"slug": slug, "available": True, "domain": f"{slug}.postly.com"})
