"""
Production settings.

Nothing here has a usable default: every secret and origin must come from the
environment, and the module raises ImproperlyConfigured on anything missing.
"""

from .base import *  # noqa: F403
from .base import env

DEBUG = False

# No default — django-environ raises ImproperlyConfigured if this is unset.
SECRET_KEY = env("DJANGO_SECRET_KEY")

ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
# Required, not optional: session auth means every unsafe request from the
# Next.js origin is CSRF-checked against this list.
CSRF_TRUSTED_ORIGINS = env("CSRF_TRUSTED_ORIGINS")

# Assume TLS terminates at a proxy that sets X-Forwarded-Proto.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 365
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

ACCOUNT_DEFAULT_HTTP_PROTOCOL = "https"

X_FRAME_OPTIONS = "DENY"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
