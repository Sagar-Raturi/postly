"""
The per-site daily cap on notification mail.

A blast-radius bound rather than a quota anybody is meant to feel. Every
blog sends from one domain and shares one sending reputation, so one writer
with a bought list can spend the whole platform's deliverability in a single
publish. The property that matters is not "the cap is enforced" on its own —
it is that enforcing it neither drops anybody nor mails anybody twice: a
capped send stops where it is and the next day's run carries on from the
same cursor.
"""

import pytest
from django.core import mail
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone

from blog.emails import remaining_quota_today
from blog.models import Post, PostEmail, Subscriber

pytestmark = pytest.mark.django_db


@pytest.fixture
def open_site(site):
    site.subscriptions_enabled = True
    site.save(update_fields=["subscriptions_enabled"])
    return site


@pytest.fixture
def ten_readers(open_site):
    return [
        Subscriber.objects.create(
            site=open_site,
            email=f"r{n:02}@example.com",
            status=Subscriber.Status.CONFIRMED,
            confirmed_at=timezone.now(),
        )
        for n in range(10)
    ]


@pytest.fixture
def draft(open_site, user_a) -> Post:
    return Post.objects.create(site=open_site, author=user_a, title="Capped")


def publish_and_make_due(api_a, post) -> PostEmail:
    api_a.patch(
        reverse("post-detail", args=[post.pk]),
        {"status": "published"},
        format="json",
    )
    row = PostEmail.objects.get(post=post)
    row.scheduled_for = timezone.now()
    row.save(update_fields=["scheduled_for"])
    return row


class TestTheQuota:
    def test_a_fresh_site_has_the_whole_cap(self, open_site, settings):
        settings.POST_EMAIL_DAILY_CAP_PER_SITE = 2000

        assert remaining_quota_today(open_site) == 2000

    def test_sending_spends_it(self, api_a, draft, ten_readers, settings):
        settings.POST_EMAIL_DAILY_CAP_PER_SITE = 2000
        publish_and_make_due(api_a, draft)

        call_command("send_pending_post_emails")

        assert remaining_quota_today(draft.site) == 1990

    def test_it_never_goes_negative(self, api_a, draft, ten_readers, settings):
        settings.POST_EMAIL_DAILY_CAP_PER_SITE = 4
        publish_and_make_due(api_a, draft)

        call_command("send_pending_post_emails")

        assert remaining_quota_today(draft.site) == 0

    def test_one_blogs_sending_does_not_spend_anothers(
        self, api_a, draft, ten_readers, other_site, settings
    ):
        settings.POST_EMAIL_DAILY_CAP_PER_SITE = 2000
        publish_and_make_due(api_a, draft)

        call_command("send_pending_post_emails")

        assert remaining_quota_today(other_site) == 2000


class TestACappedSend:
    def test_it_stops_at_the_cap(self, api_a, draft, ten_readers, settings):
        settings.POST_EMAIL_DAILY_CAP_PER_SITE = 4
        publish_and_make_due(api_a, draft)

        call_command("send_pending_post_emails")

        assert len(mail.outbox) == 4

    def test_the_row_stays_queued(self, api_a, draft, ten_readers, settings):
        """Not marked sent — half the list has not been mailed."""
        settings.POST_EMAIL_DAILY_CAP_PER_SITE = 4
        publish_and_make_due(api_a, draft)

        call_command("send_pending_post_emails")

        row = PostEmail.objects.get()
        assert row.status == PostEmail.Status.PENDING
        assert row.sent_at is None

    def test_the_cursor_records_how_far_it_got(
        self, api_a, draft, ten_readers, settings
    ):
        settings.POST_EMAIL_DAILY_CAP_PER_SITE = 4
        publish_and_make_due(api_a, draft)

        call_command("send_pending_post_emails")

        assert PostEmail.objects.get().last_subscriber_id == ten_readers[3].pk

    def test_running_again_the_same_day_sends_nothing_more(
        self, api_a, draft, ten_readers, settings
    ):
        settings.POST_EMAIL_DAILY_CAP_PER_SITE = 4
        publish_and_make_due(api_a, draft)
        call_command("send_pending_post_emails")

        call_command("send_pending_post_emails")

        assert len(mail.outbox) == 4

    def test_it_resumes_when_the_cap_lifts(self, api_a, draft, ten_readers, settings):
        """
        Stands in for the next calendar day. The remaining six are mailed
        and nobody is mailed twice — which is the whole point of stopping
        on a cursor rather than abandoning the row.
        """
        settings.POST_EMAIL_DAILY_CAP_PER_SITE = 4
        publish_and_make_due(api_a, draft)
        call_command("send_pending_post_emails")
        first_four = {m.to[0] for m in mail.outbox}

        settings.POST_EMAIL_DAILY_CAP_PER_SITE = 2000
        call_command("send_pending_post_emails")

        everybody = [m.to[0] for m in mail.outbox]
        assert len(everybody) == 10
        assert len(set(everybody)) == 10, "somebody was mailed twice"
        assert first_four < set(everybody)

    def test_and_is_then_marked_sent(self, api_a, draft, ten_readers, settings):
        settings.POST_EMAIL_DAILY_CAP_PER_SITE = 4
        publish_and_make_due(api_a, draft)
        call_command("send_pending_post_emails")

        settings.POST_EMAIL_DAILY_CAP_PER_SITE = 2000
        call_command("send_pending_post_emails")

        row = PostEmail.objects.get()
        assert row.status == PostEmail.Status.SENT
        assert row.sent_count == 10

    def test_a_cap_of_zero_sends_nothing_and_keeps_the_row(
        self, api_a, draft, ten_readers, settings
    ):
        settings.POST_EMAIL_DAILY_CAP_PER_SITE = 0
        publish_and_make_due(api_a, draft)

        call_command("send_pending_post_emails")

        assert mail.outbox == []
        assert PostEmail.objects.get().status == PostEmail.Status.PENDING

    def test_the_cap_does_not_consume_an_attempt_budget(
        self, api_a, draft, ten_readers, settings
    ):
        """
        Being capped is not a failure, so it must not count towards
        MAX_ATTEMPTS — otherwise three capped days would mark the row
        failed and nobody would ever get the post.
        """
        settings.POST_EMAIL_DAILY_CAP_PER_SITE = 0
        publish_and_make_due(api_a, draft)

        for _ in range(5):
            call_command("send_pending_post_emails")

        row = PostEmail.objects.get()
        assert row.status == PostEmail.Status.PENDING
        # The column counts failures, and nothing failed. Were it counting
        # claims instead, five capped days would have spent the budget and
        # the first real failure afterwards would go straight to `failed`
        # without ever being retried.
        assert row.attempts == 0

    def test_a_capped_day_leaves_the_retry_budget_for_real_failures(
        self, api_a, draft, ten_readers, settings, monkeypatch
    ):
        settings.POST_EMAIL_DAILY_CAP_PER_SITE = 0
        publish_and_make_due(api_a, draft)
        for _ in range(5):
            call_command("send_pending_post_emails")

        settings.POST_EMAIL_DAILY_CAP_PER_SITE = 2000
        monkeypatch.setattr(
            "blog.emails.get_connection",
            lambda *a, **k: (_ for _ in ()).throw(OSError("smtp is down")),
        )
        call_command("send_pending_post_emails")

        row = PostEmail.objects.get()
        assert row.attempts == 1
        assert row.status == PostEmail.Status.PENDING, "still has retries left"
