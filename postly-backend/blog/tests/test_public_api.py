"""
The public, anonymous half of the API.

Everything here runs on `api` — the unauthenticated client — because that is
the whole point of these endpoints: a reader with no Postly account has to be
able to read a blog, and must not be able to reach anything else.

Two properties are load-bearing and get their own tests:

* a draft is a 404, never a 403 and never a body;
* the public serializers expose display names and published content, and
  nothing about the account behind them.
"""

import pytest
from django.urls import reverse

from blog.models import Post, Site

pytestmark = pytest.mark.django_db


def site_url(slug: str) -> str:
    return reverse("public-site", args=[slug])


def posts_url(slug: str) -> str:
    return reverse("public-post-list", args=[slug])


def post_url(slug: str, post_slug: str) -> str:
    return reverse("public-post-detail", args=[slug, post_slug])


class TestReachableWhileLoggedOut:
    """The public endpoints answer an anonymous caller."""

    def test_site_detail(self, api, site):
        response = api.get(site_url(site.slug))

        assert response.status_code == 200
        assert response.json()["name"] == site.name

    def test_post_list(self, api, site, published):
        response = api.get(posts_url(site.slug))

        assert response.status_code == 200
        assert [p["slug"] for p in response.json()["results"]] == [published.slug]

    def test_post_detail(self, api, site, published):
        response = api.get(post_url(site.slug, published.slug))

        assert response.status_code == 200
        assert response.json()["content"] == published.content

    def test_unknown_site_is_404_not_500(self, api):
        assert api.get(site_url("no-such-blog")).status_code == 404
        assert api.get(posts_url("no-such-blog")).status_code == 404

    def test_unknown_post_is_404(self, api, site, published):
        assert api.get(post_url(site.slug, "never-written")).status_code == 404


class TestDraftsAreInvisible:
    """
    The single most important property of this API.

    `draft` is the unpublished fixture; `published` is its published sibling
    on the same blog.
    """

    def test_a_draft_is_404_from_the_public_post_endpoint(self, api, site, draft):
        response = api.get(post_url(site.slug, draft.slug))

        # 404, not 403: a 403 would confirm the post exists.
        assert response.status_code == 404
        assert draft.title not in response.content.decode()

    def test_a_draft_is_absent_from_the_public_list(
        self, api, site, draft, published
    ):
        results = api.get(posts_url(site.slug)).json()["results"]

        slugs = [entry["slug"] for entry in results]
        assert published.slug in slugs
        assert draft.slug not in slugs

    def test_unpublishing_removes_a_post_from_the_public_api(
        self, api, site, published
    ):
        assert api.get(post_url(site.slug, published.slug)).status_code == 200

        published.status = Post.Status.DRAFT
        published.save()

        assert api.get(post_url(site.slug, published.slug)).status_code == 404

    def test_status_cannot_be_filtered_back_in(self, api, site, draft, published):
        """`?status=draft` is not a way to ask for drafts."""
        results = api.get(f"{posts_url(site.slug)}?status=draft").json()["results"]

        assert [entry["slug"] for entry in results] == [published.slug]

    def test_another_blogs_posts_are_not_listed(
        self, api, site, published, other_post
    ):
        results = api.get(posts_url(site.slug)).json()["results"]

        assert [entry["slug"] for entry in results] == [published.slug]


class TestNothingPrivateLeaks:
    """The serializers list public fields explicitly; this pins that list."""

    # Anything that identifies the account rather than the writer, plus the
    # internal bookkeeping a reader has no use for.
    FORBIDDEN = {"email", "id", "owner", "owner_id", "site", "user", "created_at", "updated_at"}

    def test_site_payload(self, api, site, user_a):
        body = api.get(site_url(site.slug)).json()

        assert set(body) == {
            "name",
            "slug",
            "description",
            "author",
            # The blog cannot render without these, and none of them is a
            # colour — see PublicSiteSerializer.
            "theme",
            "appearance",
            "font_pairing",
            "accent_hue",
        }
        assert body["author"] == user_a.display_name
        assert not self.FORBIDDEN & set(body)
        assert user_a.email not in response_text(body)

    def test_post_list_payload(self, api, site, published, user_a):
        entry = api.get(posts_url(site.slug)).json()["results"][0]

        assert set(entry) == {
            "title",
            "slug",
            "excerpt",
            "read_time_minutes",
            "published_at",
        }
        assert not self.FORBIDDEN & set(entry)
        # `status` is absent rather than always "published": a reader is
        # never told that drafts are a concept here.
        assert "status" not in entry

    def test_post_detail_payload(self, api, site, published, user_a):
        body = api.get(post_url(site.slug, published.slug)).json()

        assert set(body) == {
            "title",
            "slug",
            "excerpt",
            "read_time_minutes",
            "published_at",
            "content",
            "author",
        }
        assert body["author"] == user_a.display_name
        assert not self.FORBIDDEN & set(body)
        assert user_a.email not in response_text(body)

    def test_a_post_whose_author_closed_their_account_still_renders(
        self, api, site, published
    ):
        """Post.author is nulled, not cascaded — the byline must survive it."""
        published.author = None
        published.save(update_fields=["author"])

        body = api.get(post_url(site.slug, published.slug)).json()

        assert body["author"] is None
        assert body["content"] == published.content


class TestTheming:
    """
    A blog's appearance is published, because the blog cannot be drawn
    without it. What must never be published — or stored — is anything that
    lands in a stylesheet as a string.
    """

    def test_defaults_are_served_when_the_writer_has_chosen_nothing(
        self, api, site
    ):
        body = api.get(site_url(site.slug)).json()

        assert body["theme"] == Site.Theme.PAPER
        assert body["appearance"] == Site.Appearance.LIGHT
        assert body["font_pairing"] == Site.FontPairing.EDITORIAL
        # Null, not a number: "keep whatever accent the theme came with".
        assert body["accent_hue"] is None

    def test_a_writers_choices_reach_the_reader(self, api, site):
        site.theme = Site.Theme.SEPIA
        site.appearance = Site.Appearance.SYSTEM
        site.font_pairing = Site.FontPairing.PLAIN
        site.accent_hue = 264
        site.save()

        body = api.get(site_url(site.slug)).json()

        assert body["theme"] == "sepia"
        assert body["appearance"] == "system"
        assert body["font_pairing"] == "plain"
        assert body["accent_hue"] == 264

    def test_theme_fields_are_not_writable_through_the_public_api(
        self, api, site
    ):
        assert api.patch(site_url(site.slug), {"theme": "mono"}).status_code == 405

        site.refresh_from_db()
        assert site.theme == Site.Theme.PAPER


class TestThemeInputIsBounded:
    """
    The hue is formatted into a stylesheet on the blog. That is only safe
    while it cannot be anything but an integer 0-360, so the bound is a test
    rather than a comment.
    """

    SITES_URL = "/api/sites/"

    def url(self, site) -> str:
        return f"{self.SITES_URL}{site.pk}/"

    def test_a_hue_in_range_is_accepted(self, api_a, site):
        response = api_a.patch(self.url(site), {"accent_hue": 200}, format="json")

        assert response.status_code == 200
        site.refresh_from_db()
        assert site.accent_hue == 200

    @pytest.mark.parametrize("hue", [361, 1000, -1, "red", "12; }"])
    def test_anything_outside_the_range_is_refused(self, api_a, site, hue):
        response = api_a.patch(self.url(site), {"accent_hue": hue}, format="json")

        assert response.status_code == 400
        site.refresh_from_db()
        assert site.accent_hue is None

    def test_clearing_the_hue_is_allowed(self, api_a, site):
        site.accent_hue = 120
        site.save(update_fields=["accent_hue"])

        response = api_a.patch(self.url(site), {"accent_hue": None}, format="json")

        assert response.status_code == 200
        site.refresh_from_db()
        assert site.accent_hue is None

    @pytest.mark.parametrize(
        "field, value",
        [
            ("theme", "neon"),
            ("appearance", "strobe"),
            ("font_pairing", "comic-sans"),
            # The shape an injection attempt would take, if these were ever
            # free text rather than a closed set.
            ("theme", "paper; background: url(https://evil.example)"),
        ],
    )
    def test_only_known_names_are_accepted(self, api_a, site, field, value):
        response = api_a.patch(self.url(site), {field: value}, format="json")

        assert response.status_code == 400

    def test_a_writer_cannot_restyle_somebody_elses_blog(self, api_b, site):
        response = api_b.patch(self.url(site), {"theme": "mono"}, format="json")

        assert response.status_code == 404
        site.refresh_from_db()
        assert site.theme == Site.Theme.PAPER


class TestPublicEndpointsAreReadOnly:
    def test_writes_are_refused(self, api, site, published):
        assert api.post(posts_url(site.slug), {"title": "Mine now"}).status_code == 405
        assert api.delete(post_url(site.slug, published.slug)).status_code == 405
        assert api.patch(site_url(site.slug), {"name": "Mine now"}).status_code == 405

    def test_a_logged_in_writer_cannot_reach_another_blogs_drafts_either(
        self, api_b, site, draft
    ):
        """Being signed in as somebody else buys nothing here."""
        assert api_b.get(post_url(site.slug, draft.slug)).status_code == 404


class TestBodiesAreSanitized:
    """
    A published blog is served from the same origin as the dashboard until
    Phase 3, so a script in somebody's post would run with a reading
    writer's session behind it. blog/sanitize.py is what stops that; these
    pin the behaviour rather than the implementation.
    """

    def body(self, api, site, post) -> str:
        return api.get(post_url(site.slug, post.slug)).json()["content"]

    def test_script_tags_are_removed(self, api, site, published):
        published.content = "<p>Before</p><script>alert(1)</script><p>After</p>"
        published.save(update_fields=["content"])

        body = self.body(api, site, published)

        assert "<script" not in body
        assert "alert(1)" not in body
        # The surrounding prose survives — this is a filter, not a refusal.
        assert "Before" in body and "After" in body

    def test_event_handler_attributes_are_removed(self, api, site, published):
        published.content = '<p onclick="steal()">Tap me</p>'
        published.save(update_fields=["content"])

        body = self.body(api, site, published)

        assert "onclick" not in body
        assert "Tap me" in body

    def test_javascript_urls_are_removed(self, api, site, published):
        published.content = '<p><a href="javascript:alert(1)">Link</a></p>'
        published.save(update_fields=["content"])

        assert "javascript:" not in self.body(api, site, published)

    def test_ordinary_markup_survives(self, api, site, published):
        published.content = (
            "<h2>Heading</h2><p>Body with <strong>bold</strong> and "
            '<a href="https://example.com">a link</a>.</p>'
            "<blockquote><p>Quoted.</p></blockquote><ul><li>One</li></ul>"
        )
        published.save(update_fields=["content"])

        body = self.body(api, site, published)

        for fragment in ["<h2>", "<strong>", "<blockquote>", "<ul>", "<li>"]:
            assert fragment in body
        assert 'href="https://example.com"' in body

    def test_the_stored_row_is_left_alone(self, api, site, published):
        """Cleaning happens on the way out, so the editor gets its own
        markup back unchanged."""
        original = '<p onclick="x()">Kept as written</p>'
        published.content = original
        published.save(update_fields=["content"])

        published.refresh_from_db()
        assert published.content == original


class TestReadTime:
    def test_is_word_count_over_two_hundred_rounded_up(self, api, site, published):
        words = " ".join(["word"] * 450)
        published.content = f"<p>{words}</p>"
        published.save(update_fields=["content"])

        body = api.get(post_url(site.slug, published.slug)).json()

        assert body["read_time_minutes"] == 3

    def test_a_very_short_post_is_one_minute_not_zero(self, api, site, published):
        body = api.get(post_url(site.slug, published.slug)).json()

        assert body["read_time_minutes"] == 1


class TestDashboardApiStaysPrivate:
    """
    The public endpoints exist alongside the private ones, not instead of
    them. Opening one surface must not have opened the other.
    """

    @pytest.mark.parametrize("path", ["/api/sites/", "/api/posts/"])
    def test_list_endpoints_401_while_logged_out(self, api, path):
        assert api.get(path).status_code == 401

    def test_post_detail_401s_while_logged_out(self, api, published):
        assert api.get(f"/api/posts/{published.id}/").status_code == 401

    def test_creating_a_post_401s_while_logged_out(self, api, site):
        response = api.post(
            "/api/posts/", {"site": site.id, "title": "Not yours"}, format="json"
        )

        assert response.status_code == 401
        assert not site.posts.filter(title="Not yours").exists()


def response_text(body) -> str:
    """The whole payload as one string, for `x not in` assertions."""
    import json

    return json.dumps(body)
