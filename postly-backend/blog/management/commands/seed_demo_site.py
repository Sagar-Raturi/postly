"""
Creates a ready-to-use demo account: a verified user, their blog, and a few
posts.

Signup now exists, so this is no longer required to make the dashboard
usable — it is a shortcut. After a database reset it saves going through
signup and fishing the confirmation link out of the console.
"""

from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from blog.models import Post, Site

User = get_user_model()

DEMO_EMAIL = "demo@postly.test"
DEMO_PASSWORD = "small-hours-demo"
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
    help = "Create a verified demo account with a blog and sample posts."

    def add_arguments(self, parser):
        parser.add_argument("--email", default=DEMO_EMAIL)
        parser.add_argument("--password", default=DEMO_PASSWORD)
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete the demo blog's existing posts before seeding.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        email = options["email"]
        password = options["password"]

        user, user_created = User.objects.get_or_create(
            email=email,
            defaults={"display_name": "Demo Writer"},
        )
        if user_created:
            user.set_password(password)
            user.save(update_fields=["password"])
            self.stdout.write(self.style.SUCCESS(f"Created user {email}"))
        else:
            self.stdout.write(f"User {email} already exists")

        # Marked verified directly. ACCOUNT_EMAIL_VERIFICATION is mandatory,
        # so without this the demo account could be created but never used.
        _, email_created = EmailAddress.objects.update_or_create(
            user=user,
            email=email,
            defaults={"verified": True, "primary": True},
        )
        if email_created:
            self.stdout.write("Marked the address verified")

        site, site_created = Site.objects.get_or_create(
            slug=DEMO_SLUG,
            defaults={
                "owner": user,
                "name": "Small Hours",
                "description": "Essays about attention, mostly.",
            },
        )
        if site_created:
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
                defaults={
                    "content": entry["content"],
                    "status": entry["status"],
                    "author": user,
                },
            )
            added += int(post_created)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeding complete — {added} post(s) added, "
                f"{site.posts.count()} total on {site.domain}"
            )
        )
        if user_created:
            self.stdout.write(f"\nLog in at /login with {email} / {password}")
