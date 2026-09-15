import pytest

from blog.models import Post, Site


@pytest.fixture
def site(user_a) -> Site:
    return Site.objects.create(
        owner=user_a,
        name="Small Hours",
        slug="small-hours",
        description="Essays about attention, mostly.",
    )


@pytest.fixture
def other_site(user_b) -> Site:
    """A blog belonging to somebody else — the other side of every
    cross-tenant test."""
    return Site.objects.create(owner=user_b, name="Compile Time", slug="compile-time")


@pytest.fixture
def draft(site, user_a) -> Post:
    return Post.objects.create(
        site=site,
        author=user_a,
        title="Writing in public, badly",
        content="<p>The hard part is the forty minutes before writing.</p>",
    )


@pytest.fixture
def published(site, user_a) -> Post:
    return Post.objects.create(
        site=site,
        author=user_a,
        title="The year I stopped reading the news",
        content="<p>I cancelled every alert on my phone.</p>",
        status=Post.Status.PUBLISHED,
    )


@pytest.fixture
def other_post(other_site, user_b) -> Post:
    return Post.objects.create(
        site=other_site,
        author=user_b,
        title="Someone else's post",
        content="<p>Not yours to read.</p>",
    )
