import pytest

from blog.models import Post, Site

pytestmark = pytest.mark.django_db

SITES_URL = "/api/sites/"
POSTS_URL = "/api/posts/"


class TestSiteEndpoints:
    def test_list_is_paginated(self, api, site):
        response = api.get(SITES_URL)
        assert response.status_code == 200
        body = response.json()
        assert set(body) >= {"count", "results"}
        assert body["count"] == 1

    def test_list_includes_posts_count(self, api, site, draft, published):
        response = api.get(SITES_URL)
        assert response.json()["results"][0]["posts_count"] == 2

    def test_posts_count_is_present_on_a_freshly_created_site(self, api):
        """The annotation only exists on queryset reads, so POST must still work."""
        response = api.post(
            SITES_URL, {"name": "Field Report", "slug": "field-report"}, format="json"
        )
        assert response.status_code == 201
        assert response.json()["posts_count"] == 0

    def test_retrieve(self, api, site):
        response = api.get(f"{SITES_URL}{site.pk}/")
        assert response.status_code == 200
        assert response.json()["domain"] == "small-hours.postly.com"

    def test_patch_updates_a_field(self, api, site):
        response = api.patch(
            f"{SITES_URL}{site.pk}/", {"name": "Small Hours Weekly"}, format="json"
        )
        assert response.status_code == 200
        site.refresh_from_db()
        assert site.name == "Small Hours Weekly"

    def test_delete(self, api, site):
        response = api.delete(f"{SITES_URL}{site.pk}/")
        assert response.status_code == 204
        assert not Site.objects.filter(pk=site.pk).exists()

    def test_duplicate_slug_is_rejected(self, api, site):
        response = api.post(
            SITES_URL, {"name": "Copycat", "slug": "small-hours"}, format="json"
        )
        assert response.status_code == 400
        assert "slug" in response.json()

    def test_deleting_a_site_cascades_to_its_posts(self, api, site, draft):
        api.delete(f"{SITES_URL}{site.pk}/")
        assert not Post.objects.filter(pk=draft.pk).exists()


class TestPostEndpoints:
    def test_list(self, api, draft, published):
        response = api.get(POSTS_URL)
        assert response.status_code == 200
        assert response.json()["count"] == 2

    def test_list_omits_content_to_keep_the_payload_small(self, api, draft):
        row = api.get(POSTS_URL).json()["results"][0]
        assert "content" not in row
        assert "excerpt" in row

    def test_retrieve_includes_content(self, api, draft):
        response = api.get(f"{POSTS_URL}{draft.pk}/")
        assert response.status_code == 200
        assert "content" in response.json()

    def test_create(self, api, site):
        response = api.post(
            POSTS_URL,
            {"site": site.pk, "title": "A new post", "content": "<p>Body</p>"},
            format="json",
        )
        assert response.status_code == 201
        body = response.json()
        assert body["slug"] == "a-new-post"
        assert body["status"] == "draft"
        assert body["published_at"] is None

    def test_create_rejects_a_blank_title(self, api, site):
        response = api.post(
            POSTS_URL, {"site": site.pk, "title": "   "}, format="json"
        )
        assert response.status_code == 400
        assert "title" in response.json()

    def test_create_rejects_a_missing_site(self, api):
        response = api.post(POSTS_URL, {"title": "Orphan"}, format="json")
        assert response.status_code == 400
        assert "site" in response.json()

    def test_patch_autosaves_content(self, api, draft):
        response = api.patch(
            f"{POSTS_URL}{draft.pk}/", {"content": "<p>Revised</p>"}, format="json"
        )
        assert response.status_code == 200
        draft.refresh_from_db()
        assert draft.content == "<p>Revised</p>"

    def test_patch_to_published_sets_published_at(self, api, draft):
        response = api.patch(
            f"{POSTS_URL}{draft.pk}/", {"status": "published"}, format="json"
        )
        assert response.status_code == 200
        assert response.json()["published_at"] is not None

    def test_patch_back_to_draft_clears_published_at(self, api, published):
        response = api.patch(
            f"{POSTS_URL}{published.pk}/", {"status": "draft"}, format="json"
        )
        assert response.json()["published_at"] is None

    def test_slug_is_read_only(self, api, draft):
        api.patch(f"{POSTS_URL}{draft.pk}/", {"slug": "hijacked"}, format="json")
        draft.refresh_from_db()
        assert draft.slug != "hijacked"

    def test_invalid_status_is_rejected(self, api, draft):
        response = api.patch(
            f"{POSTS_URL}{draft.pk}/", {"status": "archived"}, format="json"
        )
        assert response.status_code == 400
        assert "status" in response.json()

    def test_delete(self, api, draft):
        response = api.delete(f"{POSTS_URL}{draft.pk}/")
        assert response.status_code == 204
        assert not Post.objects.filter(pk=draft.pk).exists()

    def test_retrieving_a_missing_post_is_404(self, api):
        assert api.get(f"{POSTS_URL}999999/").status_code == 404


class TestPostFiltering:
    def test_filter_by_site(self, api, draft, other_site):
        Post.objects.create(site=other_site, title="Elsewhere")

        response = api.get(POSTS_URL, {"site": draft.site_id})
        assert response.json()["count"] == 1
        assert response.json()["results"][0]["id"] == draft.pk

    def test_filter_by_status(self, api, draft, published):
        response = api.get(POSTS_URL, {"status": "published"})
        body = response.json()
        assert body["count"] == 1
        assert body["results"][0]["id"] == published.pk

    def test_filters_combine(self, api, site, draft, published, other_site):
        Post.objects.create(
            site=other_site, title="Elsewhere", status=Post.Status.PUBLISHED
        )
        response = api.get(POSTS_URL, {"site": site.pk, "status": "published"})
        assert response.json()["count"] == 1

    def test_unknown_status_value_is_a_400(self, api, draft):
        response = api.get(POSTS_URL, {"status": "nonsense"})
        assert response.status_code == 400


class TestPagination:
    def test_page_size_is_twenty(self, api, site):
        Post.objects.bulk_create(
            Post(site=site, title=f"Post {i}", slug=f"post-{i}") for i in range(25)
        )
        body = api.get(POSTS_URL).json()
        assert body["count"] == 25
        assert len(body["results"]) == 20
        assert body["next"] is not None


class TestOpenPermissions:
    def test_the_api_is_unauthenticated_in_phase_1(self, api, site):
        """
        Guards the Phase 1 assumption. When Phase 2 lands this test should
        start failing, which is the reminder to rewrite it around real auth.
        """
        assert api.get(POSTS_URL).status_code == 200
        assert (
            api.post(
                POSTS_URL, {"site": site.pk, "title": "Anyone can do this"}, format="json"
            ).status_code
            == 201
        )
