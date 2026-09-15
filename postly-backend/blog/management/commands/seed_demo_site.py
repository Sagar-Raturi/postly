"""
Creates the demo Site the Phase 1 dashboard writes into.

Phase 1 has no sign-up flow, so a blog has to exist before the dashboard is
useful. Doing it here rather than lazily inside a view keeps the API free of
hidden write side effects on GET.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from blog.models import Post, Site

DEMO_SLUG = "small-hours"

DEMO_POSTS = [
    {
        "title": "Writing in public, badly",
        "status": Post.Status.PUBLISHED,
        "content": (
            "<p>I used to think the hard part was having something to say. It "
            "isn't. The hard part is the forty minutes between deciding to "
            "write and actually writing.</p>"
            "<blockquote><p>A blog is a place to think out loud on a schedule "
            "you set yourself.</p></blockquote>"
            "<p>So I stopped improving the setup. One page, one cursor, one "
            "button that says publish.</p>"
        ),
    },
    {
        "title": "The year I stopped reading the news",
        "status": Post.Status.PUBLISHED,
        "content": (
            "<p>In January I cancelled every alert on my phone and replaced "
            "them with a single rule: if something matters, I'll hear about it "
            "twice.</p>"
            "<p>What I got back wasn't time, exactly. It was the particular "
            "kind of attention that lets a sentence finish itself.</p>"
        ),
    },
    {
        "title": "Notes on a quiet desk",
        "status": Post.Status.DRAFT,
        "content": "<p>Still a draft. That is rather the point of drafts.</p>",
    },
]


class Command(BaseCommand):
    help = "Create the demo site and sample posts used by the Phase 1 dashboard."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete the demo site's existing posts before seeding.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        site, created = Site.objects.get_or_create(
            slug=DEMO_SLUG,
            defaults={
                "name": "Small Hours",
                "description": "Essays about attention, mostly.",
            },
        )

        if created:
            self.stdout.write(self.style.SUCCESS(f"Created site “{site.name}”"))
        else:
            self.stdout.write(f"Site “{site.name}” already exists")

        if options["reset"]:
            deleted, _ = site.posts.all().delete()
            self.stdout.write(f"Removed {deleted} existing post(s)")

        added = 0
        for entry in DEMO_POSTS:
            # Matching on title keeps repeat runs idempotent.
            _, post_created = Post.objects.get_or_create(
                site=site,
                title=entry["title"],
                defaults={"content": entry["content"], "status": entry["status"]},
            )
            added += int(post_created)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeding complete — {added} post(s) added, "
                f"{site.posts.count()} total on {site.domain}"
            )
        )
