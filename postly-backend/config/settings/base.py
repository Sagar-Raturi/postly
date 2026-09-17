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
    CSRF_TRUSTED_ORIGINS=(list, []),
    EMAIL_PORT=(int, 587),
    EMAIL_USE_TLS=(bool, True),
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
    "allauth",
    "allauth.account",
    "dj_rest_auth",
    # Registration also switches on dj-rest-auth's login-time check that the
    # address has been verified, which is what makes ACCOUNT_EMAIL_VERIFICATION
    # below actually block a login.
    "dj_rest_auth.registration",
    # Deliberately no django.contrib.sites: allauth 65 does not need it, and
    # its Site model would sit next to blog.Site under the same name.
    # Local
    "accounts",
    "blog",
]

AUTH_USER_MODEL = "accounts.User"

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
    # Required by allauth 65: the app refuses to start without it.
    "allauth.account.middleware.AccountMiddleware",
    # Publishes a readable "somebody is logged in" cookie for the Next.js
    # middleware. Must come after AuthenticationMiddleware, which is what
    # puts request.user there. See the class docstring for why the session
    # cookie cannot be used for this.
    "accounts.middleware.AuthHintCookieMiddleware",
    # TODO Phase 3: add the subdomain-resolving middleware that maps
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
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        # Django's default is 8. Ten costs a writer nothing and removes a
        # large slice of the guessable keyspace.
        "OPTIONS": {"min_length": 10},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Argon2 first, so new and rehashed passwords use it. The rest stay listed
# so existing hashes remain verifiable and are upgraded on next login.
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.ScryptPasswordHasher",
]

# One hour. Long enough to find the mail, short enough that a reset link
# left in an inbox is not a standing key to the account.
PASSWORD_RESET_TIMEOUT = 60 * 60

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Avatars land here for now. TODO Phase 2+: swap for S3 via django-storages.
#
# The leading slash matters: without it `ImageField.url` is a *relative*
# path, and DRF resolves a relative path against the URL of the request it
# is answering — so an avatar on /api/public/sites/sagar/ would serialize as
# /api/public/sites/media/avatars/x.jpg, which is nothing.
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
    ],
    # Closed by default: an endpoint that forgets to state a permission is
    # private, not public. Views that must be reachable anonymously (login,
    # signup, password reset) opt out individually.
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    # Session cookies only — see the cookie block below for why there is no
    # token here. The subclass answers anonymous callers with 401 instead of
    # DRF's default 403.
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "accounts.authentication.CsrfSessionAuthentication"
    ],
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.ScopedRateThrottle"],
    # Anonymous requests are bucketed by IP, so these are per-IP limits.
    "DEFAULT_THROTTLE_RATES": {
        "auth_login": "5/min",
        "auth_password_reset": "5/min",
        "auth_signup": "10/hour",
        "auth_verify_email": "20/hour",
        # The slug check fires on every keystroke (debounced), so this one
        # is loose — it is only here to bound the enumeration rate.
        "onboarding": "60/min",
        # Everything dj-rest-auth registers that we did not subclass
        # (logout, password change, user details).
        "dj_rest_auth": "60/min",
    },
}

# --- Sessions, cookies and CSRF ---------------------------------------------
# The frontend authenticates with a session cookie, not a JWT in
# localStorage. A token in localStorage is readable by any script on the
# page, so one XSS bug is one stolen session; an httpOnly cookie cannot be
# read by JavaScript at all. Both halves of Postly are first-party, so there
# is no cross-origin requirement that would justify the trade.
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
# Must stay False: lib/api.ts reads this cookie to set X-CSRFToken on unsafe
# requests. The CSRF token is not a credential — the session cookie is, and
# that one is httpOnly.
CSRF_COOKIE_HTTPONLY = False

# Unset in dev, where both halves are on localhost. In production the API and
# the app sit on sibling subdomains, and the cookie has to be scoped to the
# parent (".postly.com") for the app to send it back.
SESSION_COOKIE_DOMAIN = env("SESSION_COOKIE_DOMAIN", default=None)

# Only the origins listed here may call the API from a browser. Deliberately
# no CORS_ALLOW_ALL_ORIGINS anywhere, in any environment — it is incompatible
# with credentialed requests, and it would hand any site a logged-in caller.
CORS_ALLOWED_ORIGINS = env("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = env("CSRF_TRUSTED_ORIGINS")

# --- allauth / dj-rest-auth --------------------------------------------------
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
# The account exists from signup, but cannot be logged into until the address
# is confirmed. dj-rest-auth's LoginSerializer enforces this.
ACCOUNT_EMAIL_VERIFICATION = "mandatory"
ACCOUNT_UNIQUE_EMAIL = True
# There is no username column on accounts.User; this stops allauth reaching
# for one.
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_ADAPTER = "accounts.adapters.PostlyAccountAdapter"
ACCOUNT_EMAIL_SUBJECT_PREFIX = ""
ACCOUNT_DEFAULT_HTTP_PROTOCOL = env("ACCOUNT_DEFAULT_HTTP_PROTOCOL", default="http")

REST_AUTH = {
    # No auth tokens: the login response carries nothing but a session
    # cookie. Leaving the default here would also require the authtoken app.
    "TOKEN_MODEL": None,
    "SESSION_LOGIN": True,
    "USE_JWT": False,
    "USER_DETAILS_SERIALIZER": "accounts.serializers.UserSerializer",
    "REGISTER_SERIALIZER": "accounts.serializers.SignupSerializer",
    # Django's PasswordResetForm signs links the confirm endpoint cannot
    # verify once allauth is installed. See the serializer's docstring.
    "PASSWORD_RESET_SERIALIZER": "accounts.serializers.PasswordResetSerializer",
    "OLD_PASSWORD_FIELD_ENABLED": True,
}

# Where the Next.js app lives. Verification and reset links point here, not
# at Django, which renders no pages for people.
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:3000").rstrip("/")

# --- Email -------------------------------------------------------------------
# dev.py swaps this for the console backend. Credentials come from the
# environment in every real deployment.
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = env("EMAIL_HOST", default="smtp.resend.com")
EMAIL_PORT = env("EMAIL_PORT")
EMAIL_USE_TLS = env("EMAIL_USE_TLS")
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Postly <hello@postly.com>")
