"""
The writer-facing half: reading your own list, counting it, exporting it.

Two properties matter more than the rest and get the most tests:

* **one writer's list is invisible to every other writer** — the ordinary
  tenant boundary, applied to the most personal data in the system;
* **`unsubscribe_token` never leaves the server** — it is a working
  credential for ending a subscription without being logged in as anyone,
  so a list endpoint that included one per row, or an export that wrote
  them all to a file, would be handing them out.
"""

import csv
import io

import pytest
from django.urls import reverse
from django.utils import timezone

from blog.csv_safety import csv_safe
from blog.models import Post, PostEmail, Subscriber

pytestmark = pytest.mark.django_db

LIST_URL = reverse("subscriber-list")
STATS_URL = reverse("subscriber-stats")
EXPORT_URL = reverse("subscriber-export")


@pytest.fixture
def open_site(site):
    site.subscriptions_enabled = True
    site.save(update_fields=["subscriptions_enabled"])
    return site


def make(site, email, status=Subscriber.Status.CONFIRMED) -> Subscriber:
    return Subscriber.objects.create(
        site=site,
        email=email,
        status=status,
        confirmed_at=(
            timezone.now() if status == Subscriber.Status.CONFIRMED else None
        ),
    )


@pytest.fixture
def a_list(open_site):
    """One of every status, so counts and filters have something to bite on."""
    return {
        "confirmed": [
            make(open_site, "one@example.com"),
            make(open_site, "two@example.com"),
        ],
        "pending": [make(open_site, "three@example.com", Subscriber.Status.PENDING)],
        "unsubscribed": [
            make(open_site, "four@example.com", Subscriber.Status.UNSUBSCRIBED)
        ],
        "bounced": [make(open_site, "five@example.com", Subscriber.Status.BOUNCED)],
        "complained": [
            make(open_site, "six@example.com", Subscriber.Status.COMPLAINED)
        ],
    }


class TestTenantIsolation:
    def test_another_writers_list_is_not_listed(self, api_b, a_list):
        """`api_b` owns a different blog entirely."""
        body = api_b.get(LIST_URL).json()

        assert body["count"] == 0

    def test_another_writers_subscriber_is_a_404(self, api_b, a_list):
        row = a_list["confirmed"][0]

        response = api_b.get(reverse("subscriber-detail", args=[row.pk]))

        assert response.status_code == 404

    def test_another_writers_counts_are_zero(self, api_b, a_list):
        body = api_b.get(STATS_URL).json()

        assert body["total"] == 0

    def test_another_writers_export_is_empty(self, api_b, a_list):
        rows = list(csv.reader(io.StringIO(api_b.get(EXPORT_URL).content.decode())))

        assert len(rows) == 1, "header only"

    def test_anonymous_callers_get_nothing(self, api, a_list):
        for url in (LIST_URL, STATS_URL, EXPORT_URL):
            assert api.get(url).status_code == 401


class TestTheTokenNeverLeaves:
    """
    `unsubscribe_token` ends a subscription for whoever holds it, with no
    session. It has no business in a payload a writer can read, and none at
    all in a file they will email to themselves.
    """

    def test_it_is_not_in_the_list(self, api_a, a_list):
        body = api_a.get(LIST_URL).json()

        assert "unsubscribe_token" not in body["results"][0]

    def test_it_is_not_in_the_detail(self, api_a, a_list):
        row = a_list["confirmed"][0]

        body = api_a.get(reverse("subscriber-detail", args=[row.pk])).json()

        assert "unsubscribe_token" not in body

    def test_no_token_value_appears_anywhere_in_the_list(self, api_a, a_list):
        """Belt and braces: not under another key either."""
        text = api_a.get(LIST_URL).content.decode()

        for rows in a_list.values():
            for row in rows:
                assert row.unsubscribe_token not in text

    def test_no_token_value_appears_in_the_export(self, api_a, a_list):
        text = api_a.get(EXPORT_URL).content.decode()

        for rows in a_list.values():
            for row in rows:
                assert row.unsubscribe_token not in text

    def test_the_payload_is_exactly_the_agreed_fields(self, api_a, a_list):
        """Pins the allowlist, so a column added later cannot appear by
        default."""
        entry = api_a.get(LIST_URL).json()["results"][0]

        assert set(entry) == {
            "id",
            "site",
            "email",
            "status",
            "source",
            "created_at",
            "confirmed_at",
            "unsubscribed_at",
        }


class TestListing:
    def test_it_lists_the_writers_own(self, api_a, a_list):
        assert api_a.get(LIST_URL).json()["count"] == 6

    def test_newest_first(self, api_a, a_list):
        results = api_a.get(LIST_URL).json()["results"]

        assert results[0]["email"] == "six@example.com"

    @pytest.mark.parametrize(
        "status,expected",
        [("confirmed", 2), ("pending", 1), ("bounced", 1), ("complained", 1)],
    )
    def test_filtering_by_status(self, api_a, a_list, status, expected):
        body = api_a.get(LIST_URL, {"status": status}).json()

        assert body["count"] == expected

    def test_searching_by_address(self, api_a, a_list):
        body = api_a.get(LIST_URL, {"search": "three@"}).json()

        assert body["count"] == 1

    def test_filtering_by_site(self, api_a, a_list, open_site):
        body = api_a.get(LIST_URL, {"site": open_site.pk}).json()

        assert body["count"] == 6


class TestReadOnly:
    """Every column is a record of something a reader did, so a writer
    cannot manufacture one."""

    def test_creating_is_refused(self, api_a, open_site):
        response = api_a.post(
            LIST_URL,
            {"site": open_site.pk, "email": "invented@example.com"},
            format="json",
        )

        assert response.status_code == 405
        assert not Subscriber.objects.filter(email="invented@example.com").exists()

    def test_confirming_by_hand_is_refused(self, api_a, a_list):
        row = a_list["pending"][0]

        response = api_a.patch(
            reverse("subscriber-detail", args=[row.pk]),
            {"status": "confirmed"},
            format="json",
        )

        assert response.status_code == 405
        row.refresh_from_db()
        assert row.status == Subscriber.Status.PENDING

    def test_deleting_is_refused(self, api_a, a_list):
        row = a_list["confirmed"][0]

        response = api_a.delete(reverse("subscriber-detail", args=[row.pk]))

        assert response.status_code == 405
        assert Subscriber.objects.filter(pk=row.pk).exists()


class TestStats:
    def test_every_status_is_present_even_at_zero(self, api_a, open_site):
        """A page that renders whatever keys arrive would drop a tile when a
        count hit zero, which reads as a bug in the page."""
        body = api_a.get(STATS_URL).json()

        assert set(body) >= {
            "pending",
            "confirmed",
            "unsubscribed",
            "bounced",
            "complained",
            "total",
            "active",
        }
        assert body["total"] == 0

    def test_the_counts_are_right(self, api_a, a_list):
        body = api_a.get(STATS_URL).json()

        assert body["confirmed"] == 2
        assert body["pending"] == 1
        assert body["unsubscribed"] == 1
        assert body["bounced"] == 1
        assert body["complained"] == 1
        assert body["total"] == 6

    def test_active_is_the_number_that_answers_the_question(self, api_a, a_list):
        """"How many people get my next post" — confirmed, and nothing
        else."""
        body = api_a.get(STATS_URL).json()

        assert body["active"] == 2

    def test_it_honours_the_same_filters_as_the_list(self, api_a, a_list, open_site):
        body = api_a.get(STATS_URL, {"site": open_site.pk}).json()

        assert body["total"] == 6


class TestExport:
    def rows(self, response):
        return list(csv.reader(io.StringIO(response.content.decode())))

    def test_it_is_a_csv_attachment(self, api_a, a_list):
        response = api_a.get(EXPORT_URL)

        assert response["Content-Type"] == "text/csv"
        assert "attachment" in response["Content-Disposition"]
        assert ".csv" in response["Content-Disposition"]

    def test_it_has_a_header_and_every_row(self, api_a, a_list):
        rows = self.rows(api_a.get(EXPORT_URL))

        assert rows[0] == [
            "email",
            "status",
            "source",
            "subscribed_at",
            "confirmed_at",
            "left_at",
        ]
        assert len(rows) == 7

    def test_it_includes_people_who_left(self, api_a, a_list):
        """An export with the unsubscribes dropped is one that, re-imported
        anywhere, mails people who asked to leave."""
        text = api_a.get(EXPORT_URL).content.decode()

        assert "four@example.com" in text
        assert "unsubscribed" in text

    def test_it_honours_filters(self, api_a, a_list):
        rows = self.rows(api_a.get(EXPORT_URL, {"status": "confirmed"}))

        assert len(rows) == 3

    def test_empty_dates_are_blank_not_none(self, api_a, a_list):
        """"None" in a spreadsheet cell is a word somebody has to explain."""
        text = api_a.get(EXPORT_URL).content.decode()

        assert "None" not in text


class TestCsvInjection:
    """
    A spreadsheet treats a cell starting `=`, `+`, `-` or `@` as a formula.
    The local part of an address may legally begin with any of them, the
    subscribe form takes addresses from strangers, and the export is opened
    in Excel — which is the whole attack.
    """

    @pytest.mark.parametrize(
        "raw",
        [
            "=cmd|'/c calc'!A1",
            "+1234",
            "-lookup",
            "@SUM(A1)",
            "\tstartswithtab",
            "\rstartswithcr",
        ],
    )
    def test_dangerous_leading_characters_are_neutralised(self, raw):
        assert csv_safe(raw).startswith("'")

    @pytest.mark.parametrize("raw", ["reader@example.com", "plain", "a=b", "1-2"])
    def test_ordinary_values_are_untouched(self, raw):
        assert csv_safe(raw) == raw

    def test_none_becomes_empty(self):
        assert csv_safe(None) == ""

    def test_an_exported_address_is_defused(self, api_a, open_site):
        """
        End to end: a formula-shaped address that really is in the database
        comes back out as text.
        """
        hostile = "=cmd|'/c calc'!A1@example.com"
        Subscriber.objects.create(
            site=open_site, email=hostile, status=Subscriber.Status.CONFIRMED
        )

        rows = list(
            csv.reader(io.StringIO(api_a.get(EXPORT_URL).content.decode()))
        )
        cell = next(row[0] for row in rows[1:] if "cmd" in row[0])

        assert cell.startswith("'")
        assert not cell.startswith("=")


class TestPerPostDeliveryStats:
    @pytest.fixture
    def published(self, api_a, open_site, user_a) -> Post:
        post = Post.objects.create(site=open_site, author=user_a, title="Out it goes")
        api_a.patch(
            reverse("post-detail", args=[post.pk]),
            {"status": "published"},
            format="json",
        )
        return post

    def test_a_draft_has_no_delivery(self, api_a, open_site, user_a):
        post = Post.objects.create(site=open_site, author=user_a, title="Still a draft")

        body = api_a.get(reverse("post-detail", args=[post.pk])).json()

        assert body["email_delivery"] is None

    def test_a_published_post_reports_it_is_queued(self, api_a, published):
        body = api_a.get(reverse("post-detail", args=[published.pk])).json()

        assert body["email_delivery"]["status"] == PostEmail.Status.PENDING
        assert body["email_delivery"]["scheduled_for"]
        assert body["email_delivery"]["sent_at"] is None

    def test_it_reports_the_count_once_sent(self, api_a, published, a_list):
        row = PostEmail.objects.get(post=published)
        row.status = PostEmail.Status.SENT
        row.sent_count = 2
        row.sent_at = timezone.now()
        row.save(update_fields=["status", "sent_count", "sent_at"])

        body = api_a.get(reverse("post-detail", args=[published.pk])).json()

        assert body["email_delivery"]["status"] == PostEmail.Status.SENT
        assert body["email_delivery"]["sent_count"] == 2

    def test_internal_bookkeeping_is_not_exposed(self, api_a, published):
        """`error` is a Python exception string and `last_subscriber_id` is
        a cursor — neither belongs in front of a writer."""
        delivery = api_a.get(reverse("post-detail", args=[published.pk])).json()[
            "email_delivery"
        ]

        assert set(delivery) == {"status", "scheduled_for", "sent_count", "sent_at"}

    def test_it_is_not_writable(self, api_a, published):
        api_a.patch(
            reverse("post-detail", args=[published.pk]),
            {"email_delivery": {"status": "sent", "sent_count": 9999}},
            format="json",
        )

        assert PostEmail.objects.get(post=published).sent_count == 0
