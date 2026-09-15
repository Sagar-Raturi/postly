import pytest

from blog.models import Post

pytestmark = pytest.mark.django_db


class TestSite:
    def test_str_is_the_name(self, site):
        assert str(site) == "Small Hours"

    def test_domain_is_built_from_the_slug(self, site):
        assert site.domain == "small-hours.postly.com"


class TestPostSlug:
    def test_slug_is_generated_from_the_title(self, site):
        post = Post.objects.create(site=site, title="Writing in Public, Badly")
        assert post.slug == "writing-in-public-badly"

    def test_duplicate_titles_on_one_site_get_suffixed(self, site):
        first = Post.objects.create(site=site, title="On Attention")
        second = Post.objects.create(site=site, title="On Attention")
        third = Post.objects.create(site=site, title="On Attention")

        assert [first.slug, second.slug, third.slug] == [
            "on-attention",
            "on-attention-2",
            "on-attention-3",
        ]

    def test_the_same_slug_may_exist_on_a_different_site(self, site, other_site):
        a = Post.objects.create(site=site, title="On Attention")
        b = Post.objects.create(site=other_site, title="On Attention")
        assert a.slug == b.slug == "on-attention"

    def test_slug_survives_a_retitle_so_published_urls_stay_stable(self, site):
        post = Post.objects.create(site=site, title="First Title")
        post.title = "A Completely Different Title"
        post.save()
        assert post.slug == "first-title"

    def test_title_with_no_sluggable_characters_falls_back(self, site):
        post = Post.objects.create(site=site, title="!!!")
        assert post.slug == "untitled"


class TestPostExcerpt:
    def test_excerpt_is_derived_from_content_with_html_stripped(self, site):
        post = Post.objects.create(
            site=site,
            title="Tags",
            content="<p>Hello <strong>there</strong>, reader.</p>",
        )
        assert post.excerpt == "Hello there, reader."

    def test_an_explicit_excerpt_is_left_alone(self, site):
        post = Post.objects.create(
            site=site, title="Tags", content="<p>Body</p>", excerpt="Chosen by hand"
        )
        assert post.excerpt == "Chosen by hand"

    def test_long_content_is_truncated(self, site):
        post = Post.objects.create(
            site=site, title="Long", content="<p>" + ("word " * 200) + "</p>"
        )
        assert len(post.excerpt) <= 201  # 200 chars plus the ellipsis
        assert post.excerpt.endswith("…")

    def test_paragraph_boundaries_do_not_glue_sentences_together(self, site):
        post = Post.objects.create(
            site=site,
            title="Two paragraphs",
            content="<p>Ends here.</p><p>Starts here.</p>",
        )
        assert post.excerpt == "Ends here. Starts here."

    def test_inline_tags_do_not_introduce_stray_spaces(self, site):
        post = Post.objects.create(
            site=site, title="Inline", content="<p>A <em>bold</em>, clear line.</p>"
        )
        assert post.excerpt == "A bold, clear line."

    def test_list_items_are_separated(self, site):
        post = Post.objects.create(
            site=site, title="List", content="<ul><li>One</li><li>Two</li></ul>"
        )
        assert post.excerpt == "One Two"


class TestPostPublishing:
    def test_a_new_post_is_a_draft_with_no_published_at(self, draft):
        assert draft.status == Post.Status.DRAFT
        assert draft.published_at is None

    def test_publishing_stamps_published_at(self, draft):
        draft.status = Post.Status.PUBLISHED
        draft.save()
        assert draft.published_at is not None

    def test_republishing_does_not_move_the_timestamp(self, published):
        original = published.published_at
        published.title = "Edited after publishing"
        published.save()
        assert published.published_at == original

    def test_unpublishing_clears_published_at(self, published):
        published.status = Post.Status.DRAFT
        published.save()
        assert published.published_at is None

    def test_is_published_property(self, draft, published):
        assert published.is_published is True
        assert draft.is_published is False


class TestPostSaveWithUpdateFields:
    def test_derived_fields_persist_even_with_a_narrow_update_fields(self, site):
        """
        save(update_fields=["status"]) would normally drop published_at, since
        the caller never listed it. Post.save() widens the set instead.
        """
        post = Post.objects.create(site=site, title="Narrow save")
        post.status = Post.Status.PUBLISHED
        post.save(update_fields=["status"])

        post.refresh_from_db()
        assert post.status == Post.Status.PUBLISHED
        assert post.published_at is not None


class TestPostOrdering:
    def test_posts_are_ordered_by_most_recently_updated(self, site):
        older = Post.objects.create(site=site, title="Older")
        newer = Post.objects.create(site=site, title="Newer")
        older.title = "Older, touched last"
        older.save()

        assert list(Post.objects.all()) == [older, newer]
