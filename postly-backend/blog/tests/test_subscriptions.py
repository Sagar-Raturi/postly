"""
The reader-facing subscription flow: subscribe, confirm, unsubscribe.

Everything here runs on `api`, the anonymous client, because a subscriber
has no Postly account. The tests are grouped by the property they defend
rather than by endpoint, because the properties are the reason the code is
shaped the way it is:

* a row is not a mailing list entry until somebody followed a link;
* the endpoints never say whether an address is on a list;
* an unsubscribe always works, twice, and is never undone by an older link;
* one blog's list is invisible to every other blog.
"""

import pytest
from django.core import signing
from django.urls import reverse

from blog.models import Post, Subscriber
from blog.public_views import SUBSCRIBE_MESSAGE
from blog.subscriptions import (
    CONFIRM_SALT,
    InvalidConfirmToken,
    make_confirm_token,
    read_confirm_token,
)

pytestmark = pytest.mark.django_db


def subscribe_url(slug: str) -> str:
    return reverse("public-subscribe", args=[slug])


CONFIRM_URL = reverse("public-subscription-confirm")
UNSUBSCRIBE_URL = reverse("public-subscription-unsubscribe")


@pytest.fixture
def open_site(site):
    """A blog with subscriptions switched on — the default is off."""
    site.subscriptions_enabled = True
    site.save(update_fields=["subscriptions_enabled"])
    return site


@pytest.fixture
def subscriber(open_site) -> Subscriber:
    """A pending subscriber: created, not yet confirmed."""
    return Subscriber.objects.create(site=open_site, email="reader@example.com")


@pytest.fixture
def confirmed(api, subscriber) -> Subscriber:
    api.post(CONFIRM_URL, {"token": make_confirm_token(subscriber)}, format="json")
    subscriber.refresh_from_db()
    return subscriber


class TestSubscribing:
    def test_creates_a_pending_row(self, api, open_site):
        response = api.post(
            subscribe_url(open_site.slug),
            {"email": "reader@example.com"},
            format="json",
        )

        assert response.status_code == 202
        subscriber = Subscriber.objects.get(site=open_site)
        assert subscriber.email == "reader@example.com"
        assert subscriber.status == Subscriber.Status.PENDING
        assert subscriber.confirmed_at is None

    def test_pending_is_not_a_mailing_list_entry(self, api, open_site):
        """The whole point of the pending state: it is not sendable."""
        api.post(
            subscribe_url(open_site.slug),
            {"email": "reader@example.com"},
            format="json",
        )

        assert Subscriber.objects.get(site=open_site).is_active is False

    def test_address_is_lowercased(self, api, open_site):
        api.post(
            subscribe_url(open_site.slug),
            {"email": "  Reader@Example.COM "},
            format="json",
        )

        assert Subscriber.objects.get(site=open_site).email == "reader@example.com"

    def test_subscribing_twice_is_one_row(self, api, open_site):
        for _ in range(2):
            api.post(
                subscribe_url(open_site.slug),
                {"email": "reader@example.com"},
                format="json",
            )

        assert Subscriber.objects.filter(site=open_site).count() == 1

    def test_case_variants_are_the_same_person(self, api, open_site):
        api.post(
            subscribe_url(open_site.slug), {"email": "reader@x.com"}, format="json"
        )
        api.post(
            subscribe_url(open_site.slug), {"email": "READER@X.com"}, format="json"
        )

        assert Subscriber.objects.filter(site=open_site).count() == 1

    def test_source_is_recorded(self, api, open_site):
        api.post(
            subscribe_url(open_site.slug),
            {"email": "reader@example.com", "source": "post"},
            format="json",
        )

        assert Subscriber.objects.get(site=open_site).source == Subscriber.Source.POST

    def test_unknown_source_is_rejected(self, api, open_site):
        response = api.post(
            subscribe_url(open_site.slug),
            {"email": "reader@example.com", "source": "smuggled-string"},
            format="json",
        )

        assert response.status_code == 400
        assert not Subscriber.objects.exists()

    def test_malformed_address_is_rejected(self, api, open_site):
        response = api.post(
            subscribe_url(open_site.slug), {"email": "not-an-address"}, format="json"
        )

        assert response.status_code == 400
        assert not Subscriber.objects.exists()

    def test_status_cannot_be_set_from_the_body(self, api, open_site):
        """The body may not skip the opt-in it exists to require."""
        api.post(
            subscribe_url(open_site.slug),
            {"email": "reader@example.com", "status": "confirmed"},
            format="json",
        )

        assert Subscriber.objects.get(site=open_site).status == (
            Subscriber.Status.PENDING
        )

    def test_site_cannot_be_set_from_the_body(self, api, open_site, other_site):
        """The blog comes from the URL, never from what was posted."""
        other_site.subscriptions_enabled = True
        other_site.save(update_fields=["subscriptions_enabled"])

        api.post(
            subscribe_url(open_site.slug),
            {"email": "reader@example.com", "site": other_site.pk},
            format="json",
        )

        assert Subscriber.objects.get().site == open_site


class TestSubscribingRevealsNothing:
    """
    The form must not become a way of asking who reads a blog.

    A stranger typing somebody else's address has to get the same answer
    whether or not that person is already subscribed.
    """

    def test_new_and_repeat_answers_are_identical(self, api, open_site):
        first = api.post(
            subscribe_url(open_site.slug),
            {"email": "reader@example.com"},
            format="json",
        )
        second = api.post(
            subscribe_url(open_site.slug),
            {"email": "reader@example.com"},
            format="json",
        )

        assert first.status_code == second.status_code == 202
        assert first.json() == second.json() == {"detail": SUBSCRIBE_MESSAGE}

    def test_confirmed_address_answers_the_same(self, api, open_site, confirmed):
        response = api.post(
            subscribe_url(open_site.slug),
            {"email": confirmed.email},
            format="json",
        )

        assert response.status_code == 202
        assert response.json() == {"detail": SUBSCRIBE_MESSAGE}

    def test_resubmitting_does_not_disturb_a_confirmed_row(
        self, api, open_site, confirmed
    ):
        confirmed_at = confirmed.confirmed_at

        api.post(
            subscribe_url(open_site.slug), {"email": confirmed.email}, format="json"
        )

        confirmed.refresh_from_db()
        assert confirmed.status == Subscriber.Status.CONFIRMED
        assert confirmed.confirmed_at == confirmed_at


class TestHoneypot:
    def test_filled_honeypot_writes_nothing(self, api, open_site):
        response = api.post(
            subscribe_url(open_site.slug),
            {"email": "bot@example.com", "website": "http://spam.example"},
            format="json",
        )

        assert not Subscriber.objects.exists()

    def test_filled_honeypot_is_indistinguishable_from_success(self, api, open_site):
        """A bot that is told it was caught is a bot that adapts."""
        caught = api.post(
            subscribe_url(open_site.slug),
            {"email": "bot@example.com", "website": "http://spam.example"},
            format="json",
        )
        real = api.post(
            subscribe_url(open_site.slug),
            {"email": "reader@example.com"},
            format="json",
        )

        assert caught.status_code == real.status_code
        assert caught.json() == real.json()


class TestSubscriptionsSwitch:
    def test_closed_blog_has_no_subscribe_endpoint(self, api, site):
        """`site` has subscriptions off — the model default."""
        response = api.post(
            subscribe_url(site.slug), {"email": "reader@example.com"}, format="json"
        )

        assert response.status_code == 404
        assert not Subscriber.objects.exists()

    def test_switching_off_stops_new_signups(self, api, open_site):
        open_site.subscriptions_enabled = False
        open_site.save(update_fields=["subscriptions_enabled"])

        response = api.post(
            subscribe_url(open_site.slug),
            {"email": "reader@example.com"},
            format="json",
        )

        assert response.status_code == 404

    def test_switching_off_keeps_existing_subscribers(self, api, open_site, confirmed):
        """The switch governs intake, not the list."""
        open_site.subscriptions_enabled = False
        open_site.save(update_fields=["subscriptions_enabled"])

        confirmed.refresh_from_db()
        assert confirmed.status == Subscriber.Status.CONFIRMED

    def test_unknown_blog_is_404(self, api):
        response = api.post(
            subscribe_url("no-such-blog"), {"email": "reader@example.com"},
            format="json",
        )

        assert response.status_code == 404


class TestConfirming:
    def test_confirms_and_becomes_sendable(self, api, subscriber):
        response = api.post(
            CONFIRM_URL, {"token": make_confirm_token(subscriber)}, format="json"
        )

        assert response.status_code == 200
        subscriber.refresh_from_db()
        assert subscriber.status == Subscriber.Status.CONFIRMED
        assert subscriber.confirmed_at is not None
        assert subscriber.is_active is True

    def test_response_names_the_blog(self, api, subscriber):
        """The page has to be able to say what was just subscribed to."""
        response = api.post(
            CONFIRM_URL, {"token": make_confirm_token(subscriber)}, format="json"
        )

        body = response.json()
        assert body["site_name"] == subscriber.site.name
        assert body["site_slug"] == subscriber.site.slug
        assert body["email"] == subscriber.email

    def test_confirming_twice_is_not_an_error(self, api, subscriber):
        """A prefetched or double-clicked link must not show a failure."""
        token = make_confirm_token(subscriber)

        first = api.post(CONFIRM_URL, {"token": token}, format="json")
        second = api.post(CONFIRM_URL, {"token": token}, format="json")

        assert first.status_code == second.status_code == 200
        assert first.json() == second.json()

    def test_confirming_twice_keeps_the_first_timestamp(self, api, subscriber):
        token = make_confirm_token(subscriber)
        api.post(CONFIRM_URL, {"token": token}, format="json")
        subscriber.refresh_from_db()
        first_time = subscriber.confirmed_at

        api.post(CONFIRM_URL, {"token": token}, format="json")

        subscriber.refresh_from_db()
        assert subscriber.confirmed_at == first_time

    @pytest.mark.parametrize(
        "token",
        ["", "nonsense", "a.b.c", signing.dumps({"pk": 1, "email": "x@example.com"})],
        ids=["empty", "garbage", "shaped-like-a-token", "signed-with-the-wrong-salt"],
    )
    def test_bad_tokens_are_refused(self, api, subscriber, token):
        response = api.post(CONFIRM_URL, {"token": token}, format="json")

        assert response.status_code == 400
        subscriber.refresh_from_db()
        assert subscriber.status == Subscriber.Status.PENDING

    def test_expired_token_is_refused(self, api, subscriber, monkeypatch):
        token = make_confirm_token(subscriber)
        monkeypatch.setattr("blog.subscriptions.CONFIRM_MAX_AGE_SECONDS", -1)

        response = api.post(CONFIRM_URL, {"token": token}, format="json")

        assert response.status_code == 400
        subscriber.refresh_from_db()
        assert subscriber.status == Subscriber.Status.PENDING

    def test_token_stops_working_if_the_address_changes(self, subscriber):
        """
        The token is pinned to the address it was minted for, so it cannot
        confirm a row that has since become somebody else's.
        """
        token = make_confirm_token(subscriber)
        subscriber.email = "someone-else@example.com"
        subscriber.save(update_fields=["email"])

        with pytest.raises(InvalidConfirmToken):
            read_confirm_token(token)

    def test_token_for_a_deleted_row_is_refused(self, api, subscriber):
        token = make_confirm_token(subscriber)
        subscriber.delete()

        assert api.post(CONFIRM_URL, {"token": token}, format="json").status_code == 400

    def test_every_failure_says_the_same_thing(self, api, subscriber):
        """No failure may reveal which kind of failure it was."""
        forged = api.post(CONFIRM_URL, {"token": "nonsense"}, format="json")
        wrong_salt = api.post(
            CONFIRM_URL,
            {"token": signing.dumps({"pk": subscriber.pk, "email": subscriber.email})},
            format="json",
        )

        assert forged.json() == wrong_salt.json()

    def test_real_salt_is_what_makes_a_token_work(self, api, subscriber):
        """Guards the salt constant against a rename that silently unpins it."""
        token = signing.dumps(
            {"pk": subscriber.pk, "email": subscriber.email}, salt=CONFIRM_SALT
        )

        assert api.post(CONFIRM_URL, {"token": token}, format="json").status_code == 200


class TestUnsubscribing:
    def test_get_describes_without_changing(self, api, confirmed):
        response = api.get(
            UNSUBSCRIBE_URL, {"token": confirmed.unsubscribe_token}
        )

        assert response.status_code == 200
        assert response.json()["site_name"] == confirmed.site.name
        confirmed.refresh_from_db()
        assert confirmed.status == Subscriber.Status.CONFIRMED

    def test_post_unsubscribes(self, api, confirmed):
        response = api.post(
            UNSUBSCRIBE_URL, {"token": confirmed.unsubscribe_token}, format="json"
        )

        assert response.status_code == 200
        confirmed.refresh_from_db()
        assert confirmed.status == Subscriber.Status.UNSUBSCRIBED
        assert confirmed.unsubscribed_at is not None
        assert confirmed.is_active is False

    def test_unsubscribing_twice_still_succeeds(self, api, confirmed):
        """An unsubscribe that errors is a complaint waiting to happen."""
        token = confirmed.unsubscribe_token

        first = api.post(UNSUBSCRIBE_URL, {"token": token}, format="json")
        second = api.post(UNSUBSCRIBE_URL, {"token": token}, format="json")

        assert first.status_code == second.status_code == 200
        assert first.json() == second.json()

    def test_the_row_is_kept(self, api, confirmed):
        """A deleted address is one the next form submission can silently
        re-add; an unsubscribed row is a standing instruction."""
        api.post(
            UNSUBSCRIBE_URL, {"token": confirmed.unsubscribe_token}, format="json"
        )

        assert Subscriber.objects.filter(pk=confirmed.pk).exists()

    def test_token_in_the_query_string_works_on_post(self, api, confirmed):
        """RFC 8058 one-click: the mail client chooses the body, so the
        token can only travel in the URL we gave it."""
        response = api.post(
            f"{UNSUBSCRIBE_URL}?token={confirmed.unsubscribe_token}",
            {"List-Unsubscribe": "One-Click"},
        )

        assert response.status_code == 200
        confirmed.refresh_from_db()
        assert confirmed.status == Subscriber.Status.UNSUBSCRIBED

    def test_a_pending_subscriber_can_unsubscribe(self, api, subscriber):
        """Someone who never confirmed must still be able to say no."""
        api.post(
            UNSUBSCRIBE_URL, {"token": subscriber.unsubscribe_token}, format="json"
        )

        subscriber.refresh_from_db()
        assert subscriber.status == Subscriber.Status.UNSUBSCRIBED

    @pytest.mark.parametrize("token", ["", "not-a-real-token"], ids=["empty", "wrong"])
    def test_bad_tokens_are_404(self, api, token):
        assert api.get(UNSUBSCRIBE_URL, {"token": token}).status_code == 404
        assert (
            api.post(UNSUBSCRIBE_URL, {"token": token}, format="json").status_code == 404
        )

    def test_missing_token_is_404(self, api):
        assert api.get(UNSUBSCRIBE_URL).status_code == 404


class TestUnsubscribeBeatsAnOldConfirmLink:
    """
    The newest instruction wins, and unsubscribe is a one-way door.

    Following a stale confirmation link after unsubscribing must not put
    somebody back on a list — that is precisely the bug that earns spam
    complaints and takes a sending domain down with it.
    """

    def test_old_confirm_link_does_not_revive(self, api, subscriber):
        token = make_confirm_token(subscriber)
        api.post(
            UNSUBSCRIBE_URL, {"token": subscriber.unsubscribe_token}, format="json"
        )

        response = api.post(CONFIRM_URL, {"token": token}, format="json")

        subscriber.refresh_from_db()
        assert response.status_code == 200
        assert subscriber.status == Subscriber.Status.UNSUBSCRIBED
        assert subscriber.is_active is False

    def test_subscribing_again_starts_over_at_pending(self, api, open_site, subscriber):
        """Re-subscribing is allowed — but it earns a fresh confirmation,
        not a restored one."""
        api.post(
            UNSUBSCRIBE_URL, {"token": subscriber.unsubscribe_token}, format="json"
        )

        api.post(
            subscribe_url(open_site.slug), {"email": subscriber.email}, format="json"
        )

        subscriber.refresh_from_db()
        assert subscriber.status == Subscriber.Status.PENDING
        assert subscriber.unsubscribed_at is None
        assert subscriber.confirmed_at is None
        assert subscriber.is_active is False


class TestTenantIsolation:
    def test_one_address_can_subscribe_to_two_blogs(self, api, open_site, other_site):
        other_site.subscriptions_enabled = True
        other_site.save(update_fields=["subscriptions_enabled"])

        for slug in (open_site.slug, other_site.slug):
            api.post(subscribe_url(slug), {"email": "reader@x.com"}, format="json")

        assert Subscriber.objects.filter(email="reader@x.com").count() == 2

    def test_unsubscribing_from_one_leaves_the_other(self, api, open_site, other_site):
        other_site.subscriptions_enabled = True
        other_site.save(update_fields=["subscriptions_enabled"])
        for slug in (open_site.slug, other_site.slug):
            api.post(subscribe_url(slug), {"email": "reader@x.com"}, format="json")

        leaving = Subscriber.objects.get(site=open_site, email="reader@x.com")
        api.post(
            UNSUBSCRIBE_URL, {"token": leaving.unsubscribe_token}, format="json"
        )

        staying = Subscriber.objects.get(site=other_site, email="reader@x.com")
        assert staying.status == Subscriber.Status.PENDING

    def test_tokens_are_not_shared_between_rows(self, api, open_site, other_site):
        other_site.subscriptions_enabled = True
        other_site.save(update_fields=["subscriptions_enabled"])
        for slug in (open_site.slug, other_site.slug):
            api.post(subscribe_url(slug), {"email": "reader@x.com"}, format="json")

        tokens = {s.unsubscribe_token for s in Subscriber.objects.all()}
        assert len(tokens) == 2


class TestSubscriberModel:
    def test_token_is_generated_and_unguessable(self, open_site):
        subscriber = Subscriber.objects.create(site=open_site, email="a@example.com")

        assert len(subscriber.unsubscribe_token) >= 40

    def test_tokens_differ(self, open_site):
        tokens = {
            Subscriber.objects.create(
                site=open_site, email=f"reader{n}@example.com"
            ).unsubscribe_token
            for n in range(5)
        }

        assert len(tokens) == 5

    def test_token_survives_an_update_fields_save(self, open_site):
        """Subscriber.save() folds what it derived into update_fields, as
        Post.save() does — without it the token would be dropped."""
        subscriber = Subscriber(site=open_site, email="a@example.com")
        subscriber.save(update_fields=None)
        subscriber.refresh_from_db()

        assert subscriber.unsubscribe_token

    def test_public_site_payload_does_not_leak_the_list(self, api, open_site):
        """A reader learns nothing about who else reads the blog."""
        Subscriber.objects.create(site=open_site, email="reader@example.com")

        body = api.get(reverse("public-site", args=[open_site.slug])).json()

        assert "subscribers" not in body
        assert "reader@example.com" not in str(body)


class TestReservedPostSlugs:
    def test_a_post_cannot_claim_the_subscription_path(self, site, user_a):
        """
        /<site>/subscription/... are real pages, so a post slugged
        "subscription" would be shadowed by them and unreachable.
        """
        post = Post.objects.create(site=site, author=user_a, title="Subscription")

        assert post.slug == "subscription-2"

    def test_ordinary_titles_are_untouched(self, site, user_a):
        post = Post.objects.create(site=site, author=user_a, title="Subscriptions")

        assert post.slug == "subscriptions"
