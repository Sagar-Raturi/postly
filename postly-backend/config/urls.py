from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    # Anonymous and read-only: what a published blog serves to readers
    # with no Postly account. Listed above the private API so the two
    # surfaces are visibly separate.
    path("api/public/", include("blog.public_urls")),
    # Callbacks from the mail provider. Reachable without a session like
    # the public API, but authenticated by an HMAC over the body rather
    # than by anything about the caller — see blog/webhooks.py.
    path("api/webhooks/", include("blog.webhook_urls")),
    path("api/", include("blog.urls")),
]

# Uploaded avatars, served by Django in every environment.
#
# Not `django.conf.urls.static.static()`: that helper returns an empty list
# whenever DEBUG is False, so under production settings it silently registers
# no route at all and every avatar 404s. The serve view it wraps has no such
# guard, so it is used directly here.
#
# Django's own docs call this inefficient, and they are right -- gunicorn
# blocks a worker for the length of each file read. It is fine for what
# MEDIA_ROOT actually holds: accounts/avatars.py crops and re-encodes every
# upload to a 512x512 image before it is stored, so these are a few KB each
# and the browser caches them. Post *body* images are not uploaded at all --
# the editor takes a remote URL (see components/dashboard/editor-toolbar.tsx).
#
# The real fix is django-storages in front of S3, which also decouples the
# backend from a single instance with a disk attached. That is the Phase 3
# item in the README, not a prerequisite for a first deployment.
urlpatterns += [
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]
