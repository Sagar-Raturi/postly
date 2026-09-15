"""
Tenancy tests: what one account can see and do to another's records.

The consistent answer is 404, not 403. A 403 would confirm that the record
exists, which is itself a leak — it turns an ID guess into a membership
oracle.
"""

import pytest

from blog.models import Post, Site

pytestmark = pytest.mark.django_db

SITES_URL = "/api/sites/"
POSTS_URL = "/api/posts/"


class TestAnonymousAccess:
    @pytest.mark.parametrize("url", [SITES_URL, POSTS_URL])
    def test_listing_is_401(self, api, url, site, draft):
        response = api.get(url)
        assert response.status_code == 401

    def test_retrieving_is_401(self, api, draft):
        assert api.get(f"{POSTS_URL}{draft.pk}/").status_code == 401

    def test_creating_is_401(self, api, site):
        response = api.post(
            POSTS_URL, {"site": site.pk, "title": "Anyone can do this"}, format="json"
        )
        assert response.status_code == 401
        assert not Post.objects.filter(title="Anyone can do this").exists()

    def test_deleting_is_401(self, api, draft):
        assert api.delete(f"{POSTS_URL}{draft.pk}/").status_code == 401
        assert Post.objects.filter(pk=draft.pk).exists()


class TestCrossTenantReads:
    def test_the_post_list_shows_only_your_own(self, api_a, draft, other_post):
        body = api_a.get(POSTS_URL).json()
        assert body["count"] == 1
        assert body["results"][0]["id"] == draft.pk

    def test_the_site_list_shows_only_your_own(self, api_a, site, other_site):
        body = api_a.get(SITES_URL).json()
        assert body["count"] == 1
        assert body["results"][0]["id"] == site.pk

    def test_reading_another_users_post_is_404(self, api_a, other_post):
        assert api_a.get(f"{POSTS_URL}{other_post.pk}/").status_code == 404

    def test_reading_another_users_site_is_404(self, api_a, other_site):
        assert api_a.get(f"{SITES_URL}{other_site.pk}/").status_code == 404

    def test_filtering_by_another_users_site_returns_nothing(
        self, api_a, other_site, other_post
    ):
        """The filter is applied to an already-narrowed queryset."""
        body = api_a.get(POSTS_URL, {"site": other_site.pk}).json()
        assert body["count"] == 0


class TestCrossTenantWrites:
    def test_updating_another_users_post_is_404(self, api_a, other_post):
        response = api_a.patch(
            f"{POSTS_URL}{other_post.pk}/", {"title": "Defaced"}, format="json"
        )
        assert response.status_code == 404

        other_post.refresh_from_db()
        assert other_post.title == "Someone else's post"

    def test_deleting_another_users_post_is_404(self, api_a, other_post):
        assert api_a.delete(f"{POSTS_URL}{other_post.pk}/").status_code == 404
        assert Post.objects.filter(pk=other_post.pk).exists()

    def test_updating_another_users_site_is_404(self, api_a, other_site):
        response = api_a.patch(
            f"{SITES_URL}{other_site.pk}/", {"name": "Defaced"}, format="json"
        )
        assert response.status_code == 404

        other_site.refresh_from_db()
        assert other_site.name == "Compile Time"

    def test_deleting_another_users_site_is_404(self, api_a, other_site):
        assert api_a.delete(f"{SITES_URL}{other_site.pk}/").status_code == 404
        assert Site.objects.filter(pk=other_site.pk).exists()

    def test_posting_onto_another_users_site_is_rejected(self, api_a, other_site):
        """
        The object-level check cannot catch this one: the post does not exist
        yet, so there is nothing to check it against. The serializer narrows
        the `site` field's queryset instead.
        """
        response = api_a.post(
            POSTS_URL, {"site": other_site.pk, "title": "Trespassing"}, format="json"
        )
        assert response.status_code == 400
        assert "site" in response.json()
        assert not Post.objects.filter(title="Trespassing").exists()


class TestOwnershipComesFromTheSession:
    def test_an_owner_in_the_body_is_ignored_when_creating_a_site(
        self, api_a, user_a, user_b
    ):
        response = api_a.post(
            SITES_URL,
            {"name": "Field Report", "slug": "field-report", "owner": user_b.pk},
            format="json",
        )
        assert response.status_code == 201

        site = Site.objects.get(slug="field-report")
        assert site.owner == user_a

    def test_an_author_in_the_body_is_ignored_when_creating_a_post(
        self, api_a, site, user_a, user_b
    ):
        response = api_a.post(
            POSTS_URL,
            {"site": site.pk, "title": "Mine after all", "author": user_b.pk},
            format="json",
        )
        assert response.status_code == 201

        post = Post.objects.get(title="Mine after all")
        assert post.author == user_a

    def test_the_author_is_recorded_from_the_session(self, api_a, site, user_a):
        api_a.post(POSTS_URL, {"site": site.pk, "title": "Attributed"}, format="json")
        assert Post.objects.get(title="Attributed").author == user_a


class TestAccountDeletion:
    def test_deleting_an_account_takes_its_blogs_with_it(self, user_a, site, draft):
        user_a.delete()
        assert not Site.objects.filter(pk=site.pk).exists()
        assert not Post.objects.filter(pk=draft.pk).exists()

    def test_a_post_survives_losing_its_author(self, site, user_a, user_b):
        """
        author is SET_NULL, not CASCADE — closing an account must not
        unpublish what it wrote. Shown with a post authored by user B on
        user A's blog, so deleting B does not take the blog with it.
        """
        post = Post.objects.create(site=site, author=user_b, title="Guest piece")

        user_b.delete()

        post.refresh_from_db()
        assert post.author is None
        assert post.title == "Guest piece"
        assert post.site == site


class TestOnboarding:
    SITE_URL = "/api/onboarding/site/"
    SLUG_URL = "/api/onboarding/slug-available/"

    def test_creating_the_first_blog(self, api_a, user_a):
        response = api_a.post(
            self.SITE_URL, {"name": "Small Hours", "slug": "small-hours"}, format="json"
        )
        assert response.status_code == 201
        assert response.json()["domain"] == "small-hours.postly.com"
        assert Site.objects.get(slug="small-hours").owner == user_a

    def test_a_second_blog_is_refused_here(self, api_a, site):
        response = api_a.post(
            self.SITE_URL, {"name": "Another", "slug": "another-one"}, format="json"
        )
        assert response.status_code == 409

    def test_onboarding_is_401_when_anonymous(self, api):
        response = api.post(
            self.SITE_URL, {"name": "Sneaky", "slug": "sneaky"}, format="json"
        )
        assert response.status_code == 401

    def test_a_free_slug_is_available(self, api_a):
        body = api_a.get(self.SLUG_URL, {"slug": "field-report"}).json()
        assert body["available"] is True
        assert body["domain"] == "field-report.postly.com"

    def test_a_taken_slug_is_not(self, api_a, site):
        body = api_a.get(self.SLUG_URL, {"slug": "small-hours"}).json()
        assert body["available"] is False
        assert "taken" in body["reason"]

    def test_another_users_slug_is_reported_as_taken(self, api_a, other_site):
        """Availability is global — subdomains are not per-account."""
        assert api_a.get(self.SLUG_URL, {"slug": "compile-time"}).json()["available"] is False

    @pytest.mark.parametrize(
        "slug", ["ab", "-leading", "trailing-", "under_score", "spaces here", "", "a" * 64]
    )
    def test_slugs_that_are_not_valid_hostnames_are_refused(self, api_a, slug):
        assert api_a.get(self.SLUG_URL, {"slug": slug}).json()["available"] is False

    def test_capitals_are_normalized_rather_than_refused(self, api_a):
        """Hostnames are case-insensitive, so this is a typo, not an error."""
        body = api_a.get(self.SLUG_URL, {"slug": "Small-Hours"}).json()
        assert body["available"] is True
        assert body["slug"] == "small-hours"

    @pytest.mark.parametrize("slug", ["www", "api", "admin", "postly"])
    def test_reserved_slugs_are_refused(self, api_a, slug):
        body = api_a.get(self.SLUG_URL, {"slug": slug}).json()
        assert body["available"] is False
        assert "reserved" in body["reason"]

    def test_the_slug_check_is_401_when_anonymous(self, api):
        assert api.get(self.SLUG_URL, {"slug": "anything"}).status_code == 401

    def test_a_reserved_slug_cannot_be_taken_through_the_api_either(self, api_a):
        response = api_a.post(self.SITE_URL, {"name": "Admin", "slug": "admin"}, format="json")
        assert response.status_code == 400
        assert "slug" in response.json()
