from django.contrib import admin

from .models import Post, Site


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "post_count", "created_at"]
    search_fields = ["name", "slug", "description"]
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields = ["created_at", "updated_at"]

    @admin.display(description="Posts")
    def post_count(self, obj: Site) -> int:
        return obj.posts.count()


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ["title", "site", "status", "updated_at", "published_at"]
    list_filter = ["status", "site", "created_at"]
    search_fields = ["title", "content", "excerpt"]
    date_hierarchy = "updated_at"
    # Both are derived in Post.save(); editing them here would be misleading.
    readonly_fields = ["slug", "published_at", "created_at", "updated_at"]
    list_select_related = ["site"]
