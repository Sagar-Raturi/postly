"""
Seeds the blog the dashboard and the public site are demonstrated with.

`seed_demo_site` exists for a quick smoke test — one writer, three posts.
This one is the fixture the real surfaces are built against: ten posts of
varying length, two of them drafts, with bodies that exercise every
typography style the reader and the dashboard's inline expander render.

Idempotent by design. Running it twice creates nothing the second time: the
user is matched on email, the site on slug, and each post on (site, title).
Existing posts are left exactly as they are, so a body edited in the
dashboard survives a re-run — pass --reset to start the posts over.
"""

from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from blog.models import Post, Site

from ._sagar_posts import POSTS

User = get_user_model()

EMAIL = "sagar@example.com"
PASSWORD = "postly1234"
DISPLAY_NAME = "Sagar Raturi"

DISPLAY_BIO = (
    "Backend engineer, occasional walker of long distances. I write about "
    "the parts of software nobody puts in the changelog, and about whatever "
    "the mountains taught me that month."
)

SITE_NAME = "Sagar Raturi"
SITE_SLUG = "sagar"
SITE_TAGLINE = "Software, mountains, and the long way round."
SITE_DESCRIPTION = (
    "Notes on software, mountains, and the things I keep relearning."
)


class Command(BaseCommand):
    help = "Create the Sagar Raturi demo account, blog and ten posts."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete the blog's existing posts before seeding, so edited "
            "bodies go back to the originals.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        user = self._user()
        site = self._site(user)

        if options["reset"]:
            deleted, _ = site.posts.all().delete()
            self.stdout.write(f"Removed {deleted} existing post(s)")

        created = self._posts(site, user)

        published = site.posts.filter(status=Post.Status.PUBLISHED).count()
        drafts = site.posts.filter(status=Post.Status.DRAFT).count()

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {SITE_NAME} — {created} post(s) added, "
                f"{published} published and {drafts} draft(s) in total."
            )
        )
        self.stdout.write(
            f"\n  Dashboard  /login as {EMAIL} / {PASSWORD}"
            f"\n  Public     /{site.slug}"
            f"\n  Phase 3    {site.domain}"
        )
        self.stdout.write(
            "\n  The public email address is off, which is the default. "
            "Turn it on under\n  Settings / Your public profile to see it "
            "in the blog's profile panel."
        )

    # -- steps ---------------------------------------------------------------

    def _user(self) -> User:
        user, created = User.objects.get_or_create(
            email=EMAIL,
            defaults={
                "display_name": DISPLAY_NAME,
                "bio": DISPLAY_BIO,
                # Left at the model default deliberately. The address stays
                # off the public blog until somebody goes and turns it on,
                # so the state a fresh install demonstrates first is the
                # private one — see PublicSiteSerializer.to_representation.
                "show_email_publicly": False,
            },
        )
        if created:
            # Only on creation: a re-run must not reset a password that has
            # since been changed.
            user.set_password(PASSWORD)
            user.save(update_fields=["password"])
            self.stdout.write(self.style.SUCCESS(f"Created user {EMAIL}"))
        else:
            self.stdout.write(f"User {EMAIL} already exists")

        # Backfilled rather than overwritten: `bio` arrived after this
        # command did, so a database seeded before the field existed has an
        # empty one — while a bio somebody has since edited is theirs.
        if not user.bio:
            user.bio = DISPLAY_BIO
            user.save(update_fields=["bio"])

        # Marked verified directly. ACCOUNT_EMAIL_VERIFICATION is mandatory,
        # so without this the account could be created but never logged into.
        EmailAddress.objects.update_or_create(
            user=user, email=EMAIL, defaults={"verified": True, "primary": True}
        )
        return user

    def _site(self, user: User) -> Site:
        site, created = Site.objects.get_or_create(
            slug=SITE_SLUG,
            defaults={
                "owner": user,
                "name": SITE_NAME,
                "tagline": SITE_TAGLINE,
                "description": SITE_DESCRIPTION,
                # The demo blog follows the reader's system setting, so a
                # fresh install shows both schemes without anyone going
                # into Settings first. A real writer picks this for
                # themselves — it is not the model's default.
                "appearance": Site.Appearance.SYSTEM,
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created site “{site.name}”"))
        else:
            self.stdout.write(f"Site “{site.name}” already exists")

        # Same backfill reasoning as the bio above.
        if not site.tagline:
            site.tagline = SITE_TAGLINE
            site.save(update_fields=["tagline"])

        return site

    def _posts(self, site: Site, user: User) -> int:
        created = 0
        for entry in POSTS:
            # Matching on title is what keeps repeat runs idempotent: the
            # slug is derived in Post.save(), so it cannot be the key here
            # without duplicating that logic.
            _, was_created = Post.objects.get_or_create(
                site=site,
                title=entry["title"],
                defaults={
                    "author": user,
                    "content": entry["content"],
                    "status": entry["status"],
                    # Passed explicitly so Post.save() keeps the historical
                    # date instead of stamping the moment of seeding.
                    "published_at": entry["published_at"],
                },
            )
            created += int(was_created)
        return created
