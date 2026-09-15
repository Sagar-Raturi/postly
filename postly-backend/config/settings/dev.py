"""
Local development settings.

Insecure key, permissive hosts, and mail printed to the terminal instead of
sent. Fine on a laptop, not fine anywhere else — prod.py is the deployable
one.
"""

from .base import *  # noqa: F403
from .base import env

DEBUG = True

# Insecure by design, and only ever used locally. prod.py demands a real key.
SECRET_KEY = env(
    "DJANGO_SECRET_KEY",
    default="django-insecure-local-dev-key-do-not-use-in-production",
)

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]", "testserver"]

# The Next.js dev server. Still an explicit allowlist, never a wildcard.
CORS_ALLOWED_ORIGINS = env(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:3000", "http://127.0.0.1:3000"],
)
CSRF_TRUSTED_ORIGINS = env(
    "CSRF_TRUSTED_ORIGINS",
    default=["http://localhost:3000", "http://127.0.0.1:3000"],
)

# Local dev is plain http, so demanding a secure cookie would mean the
# browser silently refuses to store the session and nothing ever logs in.
# prod.py sets both of these to True.
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

# Verification and password-reset links print to the runserver terminal.
# No email provider needed to work on auth locally — see the README.
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
