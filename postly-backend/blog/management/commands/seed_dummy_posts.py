"""
Adds filler posts to an existing blog, for testing against volume.

Kept apart from `seed_sagar` on purpose. That command is a *fixture*: ten
posts of real prose, chosen so the typography and the read-time estimates are
exercised against something plausible. This one is scaffolding — obviously
fake, obviously disposable, and titled so you can tell at a glance which posts
are which in a list.

Because the two are separate commands, filler never contaminates the curated
set, and `--reset` here removes only what this command created: it matches on
the title prefix rather than emptying the blog.

    python manage.py seed_dummy_posts                 # 10 onto /sagar
    python manage.py seed_dummy_posts --count 15      # enough to page
    python manage.py seed_dummy_posts --site other    # a different blog
    python manage.py seed_dummy_posts --reset         # re-create them
    python manage.py seed_dummy_posts --delete        # take them away again
"""

from datetime import datetime, timedelta, timezone as dt_timezone

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from blog.models import Post, Site

from ._lorem import dummy_body

# Every post this command makes starts with this. It is what `--reset` and
# `--delete` match on, so filler can be removed without touching real posts —
# which also means it must not be changed casually.
TITLE_PREFIX = "Dummy Post"

DEFAULT_SITE_SLUG = "sagar"
DEFAULT_COUNT = 10

# Roughly every fourth one is left unpublished, so the Drafts tab and the
# "drafts are invisible to readers" behaviour have something to chew on.
DRAFT_EVERY = 4

# Filler is dated *after* the curated posts (which run Jan–Jun 2026) so the
# two sets do not interleave in a reverse-chronological list.
FIRST_PUBLISHED = datetime(2026, 7, 2, 9, 0, tzinfo=dt_timezone.utc)
DAYS_BETWEEN = 6


class Command(BaseCommand):
    help = "Add numbered filler posts to a blog, for testing against volume."

    def add_arguments(self, parser):
        parser.add_argument(
            "--count",
            type=int,
            default=DEFAULT_COUNT,
            help=f"How many to create (default {DEFAULT_COUNT}).",
        )
        parser.add_argument(
            "--site",
            default=DEFAULT_SITE_SLUG,
            help=f"Slug of the blog to add them to (default {DEFAULT_SITE_SLUG}).",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete the existing filler posts first, then re-create them.",
        )
        parser.add_argument(
            "--delete",
            action="store_true",
            help="Delete the filler posts and create nothing.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        count = options["count"]
        if count < 1:
            raise CommandError("--count must be at least 1.")

        try:
            site = Site.objects.select_related("owner").get(slug=options["site"])
        except Site.DoesNotExist:
            raise CommandError(
                f"No blog with the slug “{options['site']}”. "
                "Run `python manage.py seed_sagar` first, or pass --site."
            ) from None

        if options["reset"] or options["delete"]:
            removed = self._remove(site)
            self.stdout.write(f"Removed {removed} filler post(s)")
            if options["delete"]:
                self._report(site)
                return

        created = self._create(site, count)
        self.stdout.write(
            self.style.SUCCESS(f"Added {created} filler post(s) to “{site.name}”")
        )
        self._report(site)

    # -- steps ---------------------------------------------------------------

    def _remove(self, site: Site) -> int:
        deleted, _ = site.posts.filter(title__startswith=TITLE_PREFIX).delete()
        return deleted

    def _create(self, site: Site, count: int) -> int:
        created = 0

        for index in range(1, count + 1):
            # Zero-padded so a plain alphabetical sort — the dashboard's
            # "Title A–Z" — puts 10 after 9 rather than after 1.
            title = f"{TITLE_PREFIX} {index:02d}"
            is_draft = index % DRAFT_EVERY == 0

            _, was_created = Post.objects.get_or_create(
                site=site,
                title=title,
                defaults={
                    "author": site.owner,
                    "content": dummy_body(index),
                    "status": Post.Status.DRAFT if is_draft else Post.Status.PUBLISHED,
                    # Explicit, so Post.save() keeps the spread-out date
                    # instead of stamping every one of them with "now".
                    "published_at": (
                        None
                        if is_draft
                        else FIRST_PUBLISHED
                        + timedelta(days=DAYS_BETWEEN * (index - 1))
                    ),
                },
            )
            created += int(was_created)

        return created

    def _report(self, site: Site) -> None:
        total = site.posts.count()
        published = site.posts.filter(status=Post.Status.PUBLISHED).count()
        filler = site.posts.filter(title__startswith=TITLE_PREFIX).count()

        self.stdout.write(
            f"\n  /{site.slug} now has {total} post(s) — "
            f"{published} published, {total - published} draft(s), "
            f"{filler} of them filler."
        )
        if total > 20:
            # PAGE_SIZE is 20, so this is the point at which the dashboard's
            # getAllPosts() and the blog index's page-following actually run
            # more than once.
            self.stdout.write(
                "  Over one page of 20 — the paginated fetches are now "
                "exercised on both surfaces."
            )
