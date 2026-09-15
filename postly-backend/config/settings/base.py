"""
Settings shared by every environment.

Nothing here may assume it is running locally. Environment-specific values
live in dev.py and prod.py, which both import * from this module.
"""

from pathlib import Path

import environ

# postly-backend/config/settings/base.py -> postly-backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DJANGO_DEBUG=(bool, False),
    DJANGO_ALLOWED_HOSTS=(list, []),
    CORS_ALLOWED_ORIGINS=(list, []),
)

# Read .env when present. Real deployments set variables in the environment
# instead, which takes precedence over anything in the file.
env_file = BASE_DIR / ".env"
if env_file.exists():
    env.read_env(env_file)

# Left as None here on purpose: dev.py supplies an insecure fallback, prod.py
# refuses to start without a real value.
SECRET_KEY = env("DJANGO_SECRET_KEY", default=None)

DEBUG = env("DJANGO_DEBUG")
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "corsheaders",
    "django_filters",
    # Local
    "blog",
]

MIDDLEWARE = [
    # CorsMiddleware has to sit above CommonMiddleware so CORS headers are
    # attached even to responses CommonMiddleware short-circuits (redirects).
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # TODO Phase 2: add the subdomain-resolving middleware that maps
    # <slug>.postly.com onto a Site and attaches it to the request.
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# DATABASE_URL understands both postgres://... and sqlite://... URLs, so the
# same setting covers Postgres in real environments and SQLite for a first run.
DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Post images land here for now. TODO Phase 2+: swap for S3 via django-storages.
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
    ],
    # TODO Phase 2: flip to rest_framework.permissions.IsAuthenticated once
    # django-allauth is wired up. Every ViewSet also states this explicitly.
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
}

# Only the origins listed here may call the API from a browser. Deliberately
# no CORS_ALLOW_ALL_ORIGINS anywhere, in any environment.
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
