"""
Rules for the slug that becomes a blog's subdomain.

Django's SlugField validator is looser than DNS: it accepts underscores and
leading hyphens, neither of which can appear in a hostname label. Since the
slug is going to be published as <slug>.postly.com, it is checked here
instead, in one place used by both the Site serializer and the onboarding
availability endpoint.
"""

import re

from django.core.exceptions import ValidationError

# A DNS label: lowercase letters, digits and interior hyphens, 3-63 chars.
# Three is a product decision rather than a technical one — one- and
# two-letter subdomains are worth keeping back.
SUBDOMAIN_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$")

MIN_LENGTH = 3
MAX_LENGTH = 63  # a DNS label may not exceed this

# Names that have to stay available for Postly itself, whether or not they
# are currently pointed at anything.
RESERVED_SLUGS = frozenset(
    {
        "about",
        "admin",
        "api",
        "app",
        "assets",
        "billing",
        "blog",
        "cdn",
        "dashboard",
        "dev",
        "docs",
        "ftp",
        "help",
        "imap",
        "localhost",
        "login",
        "mail",
        "media",
        "ns1",
        "ns2",
        "postly",
        "root",
        "signup",
        "smtp",
        "www",
        "static",
        "status",
        "support",
        "test",
        "webmail",
    }
)


def clean_subdomain(value: str) -> str:
    """
    Normalize and validate a slug, or raise ValidationError.

    Returns the lowercased slug so "Small-Hours" and "small-hours" cannot
    both be claimed.
    """
    slug = (value or "").strip().lower()

    if len(slug) < MIN_LENGTH:
        raise ValidationError(f"Use at least {MIN_LENGTH} characters.")
    if len(slug) > MAX_LENGTH:
        raise ValidationError(f"Use at most {MAX_LENGTH} characters.")
    if not SUBDOMAIN_RE.match(slug):
        raise ValidationError(
            "Use lowercase letters, numbers and hyphens, starting and ending "
            "with a letter or number."
        )
    if slug in RESERVED_SLUGS:
        raise ValidationError("That address is reserved. Try another.")

    return slug
