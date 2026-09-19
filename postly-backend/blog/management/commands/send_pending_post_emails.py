"""
Drain the post-notification outbox. Meant to be run by a cron, every minute.

    */1 * * * *  python manage.py send_pending_post_emails

Safe to run concurrently with itself. Safe to run when there is nothing to
do — it makes one indexed query and exits. Safe to run again after a crash,
which is the whole reason the outbox is a table rather than a background
thread.
"""

import logging

from django.core.management.base import BaseCommand
from django.utils import timezone

from blog.emails import MAX_ATTEMPTS, send_post_email
from blog.models import PostEmail

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Send queued new-post notifications that are due."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=10,
            help="Most posts to send in one run (default 10). Bounds how "
            "long a single cron tick can take when several posts come due "
            "together.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List what would be sent and send nothing.",
        )

    def handle(self, *args, **options):
        due = PostEmail.objects.filter(
            status=PostEmail.Status.PENDING,
            scheduled_for__lte=timezone.now(),
        ).select_related("post", "post__site")[: options["limit"]]

        if options["dry_run"]:
            for row in due:
                # ASCII only. This goes to a console, and a Windows one
                # is cp1252 by default — a single "->" spelled as an arrow
                # character crashes the whole command with a
                # UnicodeEncodeError before it sends anything. Tests do not
                # catch it, because call_command() captures to a UTF-8
                # buffer rather than to a terminal.
                self.stdout.write(
                    f"would send: {row.post.title!r} -> {row.post.site.slug}"
                )
            return

        sent_rows = 0
        for row in due:
            if self._claim(row):
                self._send(row)
                sent_rows += 1

        if sent_rows:
            self.stdout.write(self.style.SUCCESS(f"Sent {sent_rows} post email(s)."))

    @staticmethod
    def _claim(row: PostEmail) -> bool:
        """
        Take ownership of a row, or report that somebody else has it.

        A conditional UPDATE rather than select_for_update(skip_locked=True):
        that is the textbook answer and it is not portable here, because
        SQLite — which this project runs on in development — does not
        support SKIP LOCKED and raises rather than degrading. A
        compare-and-swap on `status` works identically on both backends and
        is a single statement either way: whichever process's UPDATE matches
        the `pending` row first gets a rowcount of 1, and every other gets 0
        and moves on.

        Claiming deliberately does **not** touch `attempts`. That column
        counts failures, and a run can end without failing — a send capped
        by the site's daily quota stops early and leaves the row pending on
        purpose. Counting those would spend the retry budget on days
        nothing went wrong, so that the first genuine failure afterwards
        would go straight to `failed` having never actually been retried.
        """
        claimed = PostEmail.objects.filter(
            pk=row.pk, status=PostEmail.Status.PENDING
        ).update(status=PostEmail.Status.SENDING)

        if claimed:
            row.refresh_from_db()
        return bool(claimed)

    def _send(self, row: PostEmail) -> None:
        try:
            sent = send_post_email(row)
        except Exception as exc:
            # Never let one post's failure end the run — the next row may
            # be for a different blog and perfectly sendable.
            logger.exception("Post email %s failed", row.pk)
            self._record_failure(row, exc)
            return

        self.stdout.write(f"{row.post.title!r}: {sent} sent")

    @staticmethod
    def _record_failure(row: PostEmail, exc: Exception) -> None:
        """
        Put the row back for another try, or give up on it.

        Back to `pending` while attempts remain, so the next cron tick
        retries — and because `last_subscriber_id` was committed batch by
        batch, that retry picks up near where this one stopped rather than
        mailing the first several hundred people again.

        After MAX_ATTEMPTS it becomes `failed` and stays there. A row that
        has failed three times is not going to succeed on the fourth
        without somebody looking at it, and a cron that retries forever
        turns one bad post into a permanent source of duplicate mail.
        """
        row.attempts += 1
        row.status = (
            PostEmail.Status.FAILED
            if row.attempts >= MAX_ATTEMPTS
            else PostEmail.Status.PENDING
        )
        row.error = f"{type(exc).__name__}: {exc}"[:2000]
        row.save(update_fields=["attempts", "status", "error"])
