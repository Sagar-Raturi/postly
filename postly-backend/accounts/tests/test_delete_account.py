"""
Closing an account.

The endpoint is the only irreversible thing a writer can do, so the tests
pin three things: it needs the password as well as the session, it takes
everything the account owned with it (including the avatar file, which a
cascade does not reach), and it touches nobody else's data.
"""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from blog.models import Post, PostEmail, Site, Subscriber

pytestmark = pytest.mark.django_db

User = get_user_model()

DELETE_URL = "/api/auth/user/delete/"
USER_URL = "/api/auth/user/"
AVATAR_URL = "/api/auth/user/avatar/"


@pytest.fixture
def blog_a(user_a):
    """A blog with a published post, a subscriber and a queued email."""
    site = Site.objects.create(owner=user_a, name="Small Hours", slug="small-hours")
    post = Post.objects.create(
        site=site,
        author=user_a,
        title="A post",
        content="<p>Words.</p>",
        status=Post.Status.PUBLISHED,
    )
    Subscriber.objects.create(site=site, email="reader@example.com")
    PostEmail.objects.get_or_create(
        post=post, defaults={"scheduled_for": timezone.now() + timedelta(minutes=15)}
    )
    return site


@pytest.fixture
def blog_b(user_b):
    site = Site.objects.create(owner=user_b, name="Compile Time", slug="compile-time")
    Post.objects.create(site=site, author=user_b, title="Theirs", content="<p>x</p>")
    Subscriber.objects.create(site=site, email="reader@example.com")
    return site


class TestItNeedsThePassword:
    def test_anonymous_is_401(self, api, password):
        response = api.post(DELETE_URL, {"password": password}, format="json")

        assert response.status_code == 401

    def test_a_wrong_password_deletes_nothing(self, api_a, user_a, blog_a):
        response = api_a.post(DELETE_URL, {"password": "not-it-at-all"}, format="json")

        assert response.status_code == 400
        assert "password" in response.json()
        assert User.objects.filter(pk=user_a.pk).exists()
        assert Site.objects.filter(pk=blog_a.pk).exists()

    def test_a_missing_password_deletes_nothing(self, api_a, user_a):
        response = api_a.post(DELETE_URL, {}, format="json")

        assert response.status_code == 400
        assert User.objects.filter(pk=user_a.pk).exists()

    def test_get_is_not_allowed(self, api_a):
        assert api_a.get(DELETE_URL).status_code == 405


class TestWhatGoes:
    @pytest.fixture
    def deleted(self, api_a, password, blog_a, blog_b):
        response = api_a.post(DELETE_URL, {"password": password}, format="json")
        assert response.status_code == 204
        return response

    def test_the_account_is_gone(self, deleted, user_a):
        assert not User.objects.filter(pk=user_a.pk).exists()

    def test_their_blog_posts_and_list_go_with_it(self, deleted, blog_a):
        assert not Site.objects.filter(pk=blog_a.pk).exists()
        assert not Post.objects.filter(site_id=blog_a.pk).exists()
        assert not Subscriber.objects.filter(site_id=blog_a.pk).exists()

    def test_a_queued_notification_is_never_sent(self, deleted):
        assert not PostEmail.objects.exists()

    def test_nobody_elses_data_is_touched(self, deleted, user_b, blog_b):
        assert User.objects.filter(pk=user_b.pk).exists()
        assert Site.objects.filter(pk=blog_b.pk).exists()
        assert Post.objects.filter(site=blog_b).count() == 1
        assert Subscriber.objects.filter(site=blog_b).count() == 1

    def test_the_session_ends(self, deleted, api_a):
        assert api_a.get(USER_URL).status_code == 401

    def test_the_login_hint_cookie_is_cleared(self, api_a, password, blog_a):
        api_a.cookies["postly_auth"] = "1"

        response = api_a.post(DELETE_URL, {"password": password}, format="json")

        assert response.cookies["postly_auth"].value == ""

    def test_the_address_can_sign_up_again(self, deleted, api, user_a):
        """Nothing about the old account should block a fresh start."""
        response = api.post(
            "/api/auth/signup/",
            {
                "email": user_a.email,
                "display_name": "Ada Again",
                "password1": "a-new-long-password-1",
                "password2": "a-new-long-password-1",
            },
            format="json",
        )

        assert response.status_code == 201


class TestTheAvatarFile:
    def test_the_file_is_removed_from_storage(
        self, api_a, user_a, password, make_image
    ):
        api_a.post(AVATAR_URL, {"avatar": make_image()}, format="multipart")
        user_a.refresh_from_db()
        storage, name = user_a.avatar.storage, user_a.avatar.name
        assert storage.exists(name)

        api_a.post(DELETE_URL, {"password": password}, format="json")

        assert not storage.exists(name)
