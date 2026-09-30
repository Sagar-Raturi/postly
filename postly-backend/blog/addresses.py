"""
Where a blog lives on the web — the one place that decides.

Two shapes, picked by the BLOG_DOMAIN setting:

* **Unset** (today). Every blog is a path on the app's own origin,
  `https://www.codomain.in/<slug>`, because that is what the Next.js app
  actually serves. The address is derived from FRONTEND_URL, so it is right
  in every environment without a second setting: localhost in development,
  the real domain in production.
* **Set**, e.g. `codomain.blog` (runbook step 7.8). Each blog on a subdomain
  of its own, `https://<slug>.codomain.blog`. Only set it once the frontend
  routes those hosts and the wildcard certificate has been issued. Before
  that, every writer's dashboard and every subscriber email would carry an
  address that does not open.

Everything that shows or mails a blog's address comes through here: the
dashboard (`Site.domain`, `Site.url`), the onboarding availability check,
and the links in subscriber email. Account mail — verification and password
reset — is about the app rather than a blog, and keeps using FRONTEND_URL
directly.

The address used to be hard-coded as `<slug>.postly.com`, a domain Codomain
never owned. The dashboard showed every writer that address as their own.
"""

from django.conf import settings


def blog_url(slug: str) -> str:
    """The blog's home page, absolute, with no trailing slash."""
    if settings.BLOG_DOMAIN:
        return f"https://{slug}.{settings.BLOG_DOMAIN}"
    return f"{settings.FRONTEND_URL}/{slug}"


def blog_address(slug: str) -> str:
    """
    `blog_url()` without the scheme: the address as a person reads and
    types it, e.g. `www.codomain.in/small-hours`.
    """
    return blog_url(slug).split("://", 1)[-1]
