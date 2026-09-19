"""
The fan-out: queueing a post's notification, and draining the outbox.

Three properties carry the weight here, and each one is a way of not
mailing people badly:

* **publishing queues, it does not send** — so a publish never waits on
  SMTP, and unpublishing inside the delay window catches a mistake;
* **a post is mailed at most once, ever** — enforced by the one-to-one, so
  no sequence of publish/unpublish/republish produces a second send;
* **an interrupted run resumes** rather than starting over, so a crash
  costs at most one batch of duplicates instead of the whole list.
"""

from io import StringIO

import pytest
from django.core import mail
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone

from blog.emails import cancel_post_email, schedule_post_email, send_post_email
from blog.models import Post, PostEmail, Subscriber

pytestmark = pytest.mark.django_db


def post_url(post: Post) -> str:
    return reverse("post-detail", args=[post.pk])


@pytest.fixture
def open_site(site):
    site.subscriptions_enabled = True
    site.save(update_fields=["subscriptions_enabled"])
    return site


@pytest.fixture
def readers(open_site):
    """Three confirmed subscribers, and two who must never be mailed."""
    confirmed = [
        Subscriber.objects.create(
            site=open_site,
            email=f"reader{n}@example.com",
            status=Subscriber.Status.CONFIRMED,
            confirmed_at=timezone.now(),
        )
        for n in range(3)
    ]
    Subscriber.objects.create(site=open_site, email="pending@example.com")
    Subscriber.objects.create(
        site=open_site,
        email="left@example.com",
        status=Subscriber.Status.UNSUBSCRIBED,
    )
    return confirmed


@pytest.fixture
def draft(open_site, user_a) -> Post:
    return Post.objects.create(
        site=open_site,
        author=user_a,
        title="A quiet week",
        content="<p>Not much happened, which was the point.</p>",
    )


def publish(api_a, post, **extra):
    return api_a.patch(
        post_url(post), {"status": "published", **extra}, format="json"
    )


def unpublish(api_a, post):
    return api_a.patch(post_url(post), {"status": "draft"}, format="json")


def due_now(row: PostEmail) -> PostEmail:
    """Bring a queued row's scheduled time forward, as the clock would."""
    row.scheduled_for = timezone.now()
    row.save(update_fields=["scheduled_for"])
    return row


class TestPublishingQueues:
    def test_publishing_queues_a_row(self, api_a, draft):
        assert publish(api_a, draft).status_code == 200

        assert PostEmail.objects.filter(post=draft).count() == 1

    def test_publishing_sends_nothing_yet(self, api_a, draft, readers):
        """The publish request must not wait on five hundred SMTP round
        trips, nor fail because the mail server is briefly unreachable."""
        publish(api_a, draft)

        assert mail.outbox == []

    def test_the_row_is_scheduled_into_the_future(self, api_a, draft, settings):
        settings.POST_EMAIL_DELAY_MINUTES = 15

        publish(api_a, draft)

        row = PostEmail.objects.get()
        assert row.scheduled_for > timezone.now()
        assert row.status == PostEmail.Status.PENDING

    def test_a_zero_delay_is_due_immediately(self, api_a, draft, settings):
        settings.POST_EMAIL_DELAY_MINUTES = 0

        publish(api_a, draft)

        assert PostEmail.objects.get().is_due

    def test_autosaving_a_published_post_queues_nothing_more(
        self, api_a, draft, readers
    ):
        """
        The trigger is the transition, not the value.

        PATCH is also the autosave endpoint, so an already-published post
        has `status: published` sent with it every few seconds. Acting on
        the value would mail the list once per keystroke.
        """
        publish(api_a, draft)

        for word in ("one", "two", "three"):
            api_a.patch(
                post_url(draft),
                {"status": "published", "content": f"<p>{word}</p>"},
                format="json",
            )

        assert PostEmail.objects.count() == 1

    def test_editing_a_draft_queues_nothing(self, api_a, draft):
        api_a.patch(post_url(draft), {"content": "<p>edit</p>"}, format="json")

        assert not PostEmail.objects.exists()

    def test_creating_a_post_already_published_queues(self, api_a, open_site):
        response = api_a.post(
            reverse("post-list"),
            {"site": open_site.pk, "title": "Straight out", "status": "published"},
            format="json",
        )

        assert response.status_code == 201
        assert PostEmail.objects.count() == 1

    def test_notify_false_queues_nothing(self, api_a, draft):
        """A writer fixing an old post's date should not mail anybody."""
        publish(api_a, draft, notify_subscribers=False)

        assert not PostEmail.objects.exists()

    def test_notify_subscribers_is_not_echoed_back(self, api_a, draft):
        body = publish(api_a, draft).json()

        assert "notify_subscribers" not in body

    def test_a_blog_without_subscriptions_queues_nothing(self, api_a, site, user_a):
        post = Post.objects.create(site=site, author=user_a, title="No list here")

        publish(api_a, post)

        assert not PostEmail.objects.exists()


class TestUnpublishingCancels:
    def test_unpublishing_inside_the_window_drops_the_row(self, api_a, draft):
        publish(api_a, draft)

        unpublish(api_a, draft)

        assert not PostEmail.objects.exists()

    def test_and_then_nothing_is_ever_sent(self, api_a, draft, readers):
        publish(api_a, draft)
        unpublish(api_a, draft)

        call_command("send_pending_post_emails")

        assert mail.outbox == []

    def test_republishing_after_a_cancel_queues_again(self, api_a, draft):
        publish(api_a, draft)
        unpublish(api_a, draft)

        publish(api_a, draft)

        assert PostEmail.objects.count() == 1

    def test_a_sent_row_is_not_cancelled(self, api_a, draft, readers):
        """The mail is in people's inboxes; there is nothing to undo, and
        deleting the record would let the next publish send it again."""
        publish(api_a, draft)
        due_now(PostEmail.objects.get())
        call_command("send_pending_post_emails")

        unpublish(api_a, draft)

        assert PostEmail.objects.get().status == PostEmail.Status.SENT

    def test_cancel_post_email_reports_what_it_did(self, api_a, draft):
        publish(api_a, draft)

        assert cancel_post_email(draft) is True
        assert cancel_post_email(draft) is False


class TestMailedAtMostOnce:
    def test_republishing_after_a_send_mails_nobody_again(
        self, api_a, draft, readers
    ):
        """The property the one-to-one exists for."""
        publish(api_a, draft)
        due_now(PostEmail.objects.get())
        call_command("send_pending_post_emails")
        assert len(mail.outbox) == 3

        unpublish(api_a, draft)
        publish(api_a, draft)
        call_command("send_pending_post_emails")

        assert len(mail.outbox) == 3

    def test_schedule_returns_none_when_a_row_exists(self, api_a, draft):
        publish(api_a, draft)

        assert schedule_post_email(draft) is None

    def test_running_the_command_twice_sends_once(self, api_a, draft, readers):
        publish(api_a, draft)
        due_now(PostEmail.objects.get())

        call_command("send_pending_post_emails")
        call_command("send_pending_post_emails")

        assert len(mail.outbox) == 3


class TestTheCommand:
    def test_sends_to_confirmed_subscribers_only(self, api_a, draft, readers):
        publish(api_a, draft)
        due_now(PostEmail.objects.get())

        call_command("send_pending_post_emails")

        recipients = {m.to[0] for m in mail.outbox}
        assert recipients == {r.email for r in readers}
        assert "pending@example.com" not in recipients
        assert "left@example.com" not in recipients

    def test_a_row_not_yet_due_is_left_alone(self, api_a, draft, readers, settings):
        settings.POST_EMAIL_DELAY_MINUTES = 15
        publish(api_a, draft)

        call_command("send_pending_post_emails")

        assert mail.outbox == []
        assert PostEmail.objects.get().status == PostEmail.Status.PENDING

    def test_the_row_is_marked_sent(self, api_a, draft, readers):
        publish(api_a, draft)
        due_now(PostEmail.objects.get())

        call_command("send_pending_post_emails")

        row = PostEmail.objects.get()
        assert row.status == PostEmail.Status.SENT
        assert row.sent_at is not None
        assert row.sent_count == 3

    def test_a_blog_with_no_subscribers_is_fine(self, api_a, draft):
        publish(api_a, draft)
        due_now(PostEmail.objects.get())

        call_command("send_pending_post_emails")

        row = PostEmail.objects.get()
        assert row.status == PostEmail.Status.SENT
        assert row.sent_count == 0

    def test_nothing_due_does_nothing(self):
        call_command("send_pending_post_emails")

        assert mail.outbox == []

    def test_dry_run_sends_nothing(self, api_a, draft, readers):
        publish(api_a, draft)
        due_now(PostEmail.objects.get())

        call_command("send_pending_post_emails", "--dry-run")

        assert mail.outbox == []
        assert PostEmail.objects.get().status == PostEmail.Status.PENDING

    @pytest.mark.parametrize("args", [(), ("--dry-run",)], ids=["send", "dry-run"])
    def test_output_is_ascii_only(self, api_a, draft, readers, args):
        """
        Regression: an arrow character in the dry-run output crashed the
        whole command with UnicodeEncodeError on Windows, whose console is
        cp1252 — before it sent anything.

        The other tests could not catch it, and still cannot: call_command()
        captures to a UTF-8 buffer, so the encode that fails on a real
        terminal never happens. Asserting the bytes are ASCII is the part
        that does transfer.
        """
        publish(api_a, draft)
        due_now(PostEmail.objects.get())
        out = StringIO()

        call_command("send_pending_post_emails", *args, stdout=out)

        out.getvalue().encode("ascii")  # raises if a stray glyph creeps back

    def test_one_blogs_failure_does_not_stop_another(
        self, api_a, draft, readers, monkeypatch
    ):
        """A run handles several posts; one bad row must not end it."""
        second = Post.objects.create(
            site=draft.site, author=draft.author, title="The other one"
        )
        publish(api_a, draft)
        publish(api_a, second)
        for row in PostEmail.objects.all():
            due_now(row)

        calls = {"n": 0}
        real = send_post_email

        def flaky(row, **kwargs):
            calls["n"] += 1
            if calls["n"] == 1:
                raise OSError("smtp is down")
            return real(row, **kwargs)

        monkeypatch.setattr(
            "blog.management.commands.send_pending_post_emails.send_post_email", flaky
        )

        call_command("send_pending_post_emails")

        statuses = set(PostEmail.objects.values_list("status", flat=True))
        assert PostEmail.Status.SENT in statuses
        assert len(mail.outbox) == 3


class TestFailureAndRetry:
    @pytest.fixture
    def broken_smtp(self, monkeypatch):
        def explode(*args, **kwargs):
            raise OSError("smtp is down")

        monkeypatch.setattr("blog.emails.get_connection", explode)

    def test_a_failure_goes_back_to_pending(self, api_a, draft, readers, broken_smtp):
        publish(api_a, draft)
        due_now(PostEmail.objects.get())

        call_command("send_pending_post_emails")

        row = PostEmail.objects.get()
        assert row.status == PostEmail.Status.PENDING
        assert row.attempts == 1
        assert "smtp is down" in row.error

    def test_it_retries_on_the_next_tick(self, api_a, draft, readers, monkeypatch):
        publish(api_a, draft)
        due_now(PostEmail.objects.get())

        def explode(*args, **kwargs):
            raise OSError("smtp is down")

        monkeypatch.setattr("blog.emails.get_connection", explode)
        call_command("send_pending_post_emails")
        assert mail.outbox == []

        monkeypatch.undo()
        call_command("send_pending_post_emails")

        assert len(mail.outbox) == 3
        assert PostEmail.objects.get().status == PostEmail.Status.SENT

    def test_it_gives_up_after_max_attempts(self, api_a, draft, readers, broken_smtp):
        publish(api_a, draft)
        due_now(PostEmail.objects.get())

        for _ in range(4):
            call_command("send_pending_post_emails")

        row = PostEmail.objects.get()
        assert row.status == PostEmail.Status.FAILED
        assert row.attempts == 3

    def test_a_failed_row_is_not_picked_up_again(self, api_a, draft, readers):
        publish(api_a, draft)
        row = due_now(PostEmail.objects.get())
        row.status = PostEmail.Status.FAILED
        row.save(update_fields=["status"])

        call_command("send_pending_post_emails")

        assert mail.outbox == []


class TestResumingAnInterruptedRun:
    @pytest.fixture
    def many(self, open_site):
        return [
            Subscriber.objects.create(
                site=open_site,
                email=f"r{n:03}@example.com",
                status=Subscriber.Status.CONFIRMED,
                confirmed_at=timezone.now(),
            )
            for n in range(10)
        ]

    def test_the_cursor_advances_with_each_batch(self, api_a, draft, many):
        publish(api_a, draft)
        row = due_now(PostEmail.objects.get())
        row.status = PostEmail.Status.SENDING
        row.save(update_fields=["status"])

        send_post_email(row, batch_size=4)

        assert row.last_subscriber_id == many[-1].pk
        assert row.sent_count == 10

    def test_a_resumed_run_skips_who_was_already_mailed(self, api_a, draft, many):
        """
        The point of the cursor: a crash after six recipients costs at most
        one batch of duplicates on retry, not six.
        """
        publish(api_a, draft)
        row = due_now(PostEmail.objects.get())
        row.status = PostEmail.Status.SENDING
        row.last_subscriber_id = many[5].pk
        row.sent_count = 6
        row.save(update_fields=["status", "last_subscriber_id", "sent_count"])

        send_post_email(row, batch_size=4)

        recipients = {m.to[0] for m in mail.outbox}
        assert recipients == {s.email for s in many[6:]}
        assert len(mail.outbox) == 4

    def test_batching_does_not_change_who_is_reached(self, api_a, draft, many):
        publish(api_a, draft)
        row = due_now(PostEmail.objects.get())
        row.status = PostEmail.Status.SENDING
        row.save(update_fields=["status"])

        send_post_email(row, batch_size=3)

        assert {m.to[0] for m in mail.outbox} == {s.email for s in many}


class TestTenantIsolation:
    def test_only_this_blogs_subscribers_are_mailed(
        self, api_a, draft, readers, other_site
    ):
        other_site.subscriptions_enabled = True
        other_site.save(update_fields=["subscriptions_enabled"])
        Subscriber.objects.create(
            site=other_site,
            email="someone-elses-reader@example.com",
            status=Subscriber.Status.CONFIRMED,
            confirmed_at=timezone.now(),
        )

        publish(api_a, draft)
        due_now(PostEmail.objects.get())
        call_command("send_pending_post_emails")

        recipients = {m.to[0] for m in mail.outbox}
        assert "someone-elses-reader@example.com" not in recipients
        assert len(recipients) == 3


class TestTheMessage:
    @pytest.fixture(autouse=True)
    def sent(self, api_a, draft, readers):
        publish(api_a, draft)
        due_now(PostEmail.objects.get())
        call_command("send_pending_post_emails")
        return mail.outbox[0]

    def test_the_subject_is_the_post_title(self, sent, draft):
        assert sent.subject == draft.title

    def test_it_is_from_the_blog(self, sent, open_site):
        assert sent.from_email.startswith(f"{open_site.name} <")

    def test_one_message_per_person_not_one_with_everybody_on_it(self, sent):
        """A BCC'd newsletter cannot carry a per-person unsubscribe link,
        and a CC'd one hands every reader everybody else's address."""
        assert len(sent.to) == 1
        assert not sent.cc
        assert not sent.bcc

    def test_it_links_to_the_post(self, sent, draft, settings):
        assert f"{settings.FRONTEND_URL}/{draft.site.slug}/{draft.slug}" in sent.body

    def test_every_recipient_gets_their_own_unsubscribe_link(self, readers):
        links = {
            m.extra_headers["List-Unsubscribe"] for m in mail.outbox
        }

        assert len(links) == len(readers)

    def test_the_unsubscribe_link_carries_that_persons_token(self, readers):
        by_address = {m.to[0]: m for m in mail.outbox}

        for reader in readers:
            assert reader.unsubscribe_token in by_address[reader.email].body

    def test_it_carries_the_one_click_headers(self, sent):
        """Gmail and Yahoo require both from bulk senders."""
        assert sent.extra_headers["List-Unsubscribe"].startswith("<")
        assert (
            sent.extra_headers["List-Unsubscribe-Post"]
            == "List-Unsubscribe=One-Click"
        )

    def test_the_visible_unsubscribe_link_is_there_too(self, sent):
        """The header is ignored by plenty of clients, and a reader who
        cannot find a way out reaches for "report spam" instead."""
        html, _ = sent.alternatives[0]

        assert "Unsubscribe</a>" in html
        assert "/subscription/unsubscribe?token=" in html

    def test_no_unrendered_template_syntax(self, sent):
        html, _ = sent.alternatives[0]

        for fragment in ("{#", "#}", "{%", "%}", "{{", "}}"):
            assert fragment not in html
            assert fragment not in sent.body

    def test_the_unsubscribe_link_actually_works(self, api, readers):
        """End to end: the link in a real sent message ends the
        subscription."""
        message = mail.outbox[0]
        token = message.extra_headers["List-Unsubscribe"].split("token=")[1].rstrip(">")

        response = api.post(
            reverse("public-subscription-unsubscribe"), {"token": token}, format="json"
        )

        assert response.status_code == 200
        assert Subscriber.objects.get(email=message.to[0]).status == (
            Subscriber.Status.UNSUBSCRIBED
        )
