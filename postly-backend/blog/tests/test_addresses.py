"""
Where a blog's address comes from: FRONTEND_URL today, BLOG_DOMAIN once
blogs have subdomains. See blog/addresses.py.
"""

import pytest

from blog.addresses import blog_address, blog_url
from blog.emails import confirmation_url, post_url, unsubscribe_url
from blog.models import Subscriber
from config.settings.base import env_list

pytestmark = pytest.mark.django_db


@pytest.fixture
def on_app_paths(settings):
    settings.FRONTEND_URL = "https://www.codomain.in"
    settings.BLOG_DOMAIN = ""


@pytest.fixture
def on_subdomains(settings):
    settings.FRONTEND_URL = "https://www.codomain.in"
    settings.BLOG_DOMAIN = "codomain.blog"


class TestBlogAddress:
    def test_without_a_blog_domain_a_blog_is_a_path_on_the_app(self, on_app_paths):
        assert blog_url("small-hours") == "https://www.codomain.in/small-hours"
        assert blog_address("small-hours") == "www.codomain.in/small-hours"

    def test_with_a_blog_domain_a_blog_is_a_subdomain(self, on_subdomains):
        assert blog_url("small-hours") == "https://small-hours.codomain.blog"
        assert blog_address("small-hours") == "small-hours.codomain.blog"

    def test_the_site_reports_the_same_address(self, site, on_subdomains):
        assert site.domain == "small-hours.codomain.blog"
        assert site.url == "https://small-hours.codomain.blog"


class TestLinksInSubscriberEmail:
    """Every link a reader gets follows the blog to its subdomain, so the
    move is a settings change rather than a hunt through templates."""

    def test_post_links_follow_the_blog(self, published, on_subdomains):
        assert post_url(published) == (
            f"https://small-hours.codomain.blog/{published.slug}"
        )

    def test_confirm_and_unsubscribe_links_follow_the_blog(self, site, on_subdomains):
        subscriber = Subscriber.objects.create(site=site, email="reader@example.com")
        assert confirmation_url(subscriber).startswith(
            "https://small-hours.codomain.blog/subscription/confirm?token="
        )
        assert unsubscribe_url(subscriber).startswith(
            "https://small-hours.codomain.blog/subscription/unsubscribe?token="
        )


class TestEnvList:
    """The host and origin lists read from the environment."""

    def test_spaces_and_trailing_slashes_are_dropped(self, monkeypatch):
        monkeypatch.setenv(
            "CSRF_TRUSTED_ORIGINS",
            "https://www.codomain.in/, https://postly-kappa-flame.vercel.app ,",
        )
        assert env_list("CSRF_TRUSTED_ORIGINS") == [
            "https://www.codomain.in",
            "https://postly-kappa-flame.vercel.app",
        ]

    def test_unset_is_empty(self, monkeypatch):
        monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)
        assert env_list("CORS_ALLOWED_ORIGINS") == []
