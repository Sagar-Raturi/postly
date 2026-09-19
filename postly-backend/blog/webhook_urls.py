"""
URLs for provider callbacks, mounted at /api/webhooks/.

Its own file, beside public_urls.py, for the same reason that one exists:
this is a surface reachable without a session, so it is worth being able to
read every path on it at once. There is one.

Not folded into public_urls.py, because the two are public in different
ways. Those endpoints are public to *people* — a reader's browser calls
them. This one is public only to the mail provider, and what stands in for
authentication is an HMAC over the request body rather than anything about
who is asking.
"""

from django.urls import path

from .webhooks import ResendWebhookView

urlpatterns = [
    path("resend/", ResendWebhookView.as_view(), name="resend-webhook"),
]
