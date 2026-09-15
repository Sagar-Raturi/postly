"""
Local development settings.

WARNING: Phase 1 ships no authentication — the API is completely open. These
settings are for a local machine only. Do not expose this server to a network.
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

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
