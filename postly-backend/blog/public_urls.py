"""
URLs for the anonymous blog API, mounted at /api/public/.

Kept apart from blog/urls.py so the public surface is one short file: if a
path is not listed here, it is not reachable without a session.

Phase 3 note: when blogs move to <slug>.postly.com, the slug will come from
the Host header instead of the path. That changes how `slug` is resolved,
not these views — see the TODO in settings.MIDDLEWARE.
"""

from django.urls import path

from .public_views import PublicPostDetailView, PublicPostListView, PublicSiteView

urlpatterns = [
    path("sites/<slug:slug>/", PublicSiteView.as_view(), name="public-site"),
    path(
        "sites/<slug:slug>/posts/",
        PublicPostListView.as_view(),
        name="public-post-list",
    ),
    path(
        "sites/<slug:slug>/posts/<slug:post_slug>/",
        PublicPostDetailView.as_view(),
        name="public-post-detail",
    ),
]
