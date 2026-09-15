import pytest
from rest_framework.test import APIClient

from blog.models import Post, Site


@pytest.fixture
def api() -> APIClient:
    return APIClient()


@pytest.fixture
def site(db) -> Site:
    return Site.objects.create(
        name="Small Hours",
        slug="small-hours",
        description="Essays about attention, mostly.",
    )


@pytest.fixture
def other_site(db) -> Site:
    return Site.objects.create(name="Compile Time", slug="compile-time")


@pytest.fixture
def draft(site) -> Post:
    return Post.objects.create(
        site=site,
        title="Writing in public, badly",
        content="<p>The hard part is the forty minutes before writing.</p>",
    )


@pytest.fixture
def published(site) -> Post:
    return Post.objects.create(
        site=site,
        title="The year I stopped reading the news",
        content="<p>I cancelled every alert on my phone.</p>",
        status=Post.Status.PUBLISHED,
    )
