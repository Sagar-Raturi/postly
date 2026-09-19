from django.contrib import admin

from .models import Post, PostEmail, Site, Subscriber


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "owner", "post_count", "created_at"]
    list_filter = ["created_at"]
    list_select_related = ["owner"]
    search_fields = ["name", "slug", "description", "owner__email"]
    autocomplete_fields = ["owner"]
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields = ["created_at", "updated_at"]

    @admin.display(description="Posts")
    def post_count(self, obj: Site) -> int:
        return obj.posts.count()


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ["title", "site", "author", "status", "updated_at", "published_at"]
    list_filter = ["status", "site", "created_at"]
    search_fields = ["title", "content", "excerpt", "author__email"]
    autocomplete_fields = ["author"]
    date_hierarchy = "updated_at"
    # Both are derived in Post.save(); editing them here would be misleading.
    readonly_fields = ["slug", "published_at", "created_at", "updated_at"]
    list_select_related = ["site", "author"]


@admin.register(Subscriber)
class SubscriberAdmin(admin.ModelAdmin):
    """
    Read-mostly on purpose.

    Everything that decides whether an address may be mailed — `status`,
    `confirmed_at`, `unsubscribed_at` — is read-only here, because each one
    is a record of something a reader did. A staff member who could set
    `status` to "confirmed" by hand would be manufacturing consent that
    nobody gave, and `confirmed_at` would be a timestamp for an event that
    never happened. Those columns are the evidence; they are changed by the
    endpoints in public_views.py and by nothing else.

    `unsubscribe_token` is absent rather than read-only: it is a working
    credential for ending somebody's subscription, and it has no business
    being on a list view or in a change form.
    """

    list_display = ["email", "site", "status", "source", "created_at", "confirmed_at"]
    list_filter = ["status", "source", "site", "created_at"]
    list_select_related = ["site"]
    search_fields = ["email", "site__name", "site__slug"]
    date_hierarchy = "created_at"
    readonly_fields = [
        "status",
        "source",
        "created_at",
        "confirmed_at",
        "unsubscribed_at",
    ]
    fields = ["site", "email", *readonly_fields]


@admin.register(PostEmail)
class PostEmailAdmin(admin.ModelAdmin):
    """
    The outbox, for looking at rather than editing.

    Everything except `status` is read-only. `status` is editable for one
    reason: a row that has exhausted its attempts sits at `failed` and the
    cron will never touch it again, so putting it back to `pending` by hand
    is the retry. That is a deliberate, considered action, which is exactly
    what an admin form is for.

    Nothing here can be created by hand. A row exists because somebody
    published a post, and one conjured up in the admin would be a
    notification for a post nobody published.
    """

    list_display = [
        "post",
        "site",
        "status",
        "scheduled_for",
        "sent_count",
        "attempts",
        "sent_at",
    ]
    list_filter = ["status", "scheduled_for"]
    list_select_related = ["post", "post__site"]
    search_fields = ["post__title", "post__site__name"]
    date_hierarchy = "scheduled_for"
    readonly_fields = [
        "post",
        "scheduled_for",
        "last_subscriber_id",
        "recipient_count",
        "sent_count",
        "attempts",
        "error",
        "created_at",
        "sent_at",
    ]

    @admin.display(description="Blog")
    def site(self, obj: PostEmail):
        return obj.post.site

    def has_add_permission(self, request) -> bool:
        return False
