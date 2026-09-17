from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Django's UserAdmin, re-pointed at email.

    The stock fieldsets name a `username` field this model does not have,
    so every one of them has to be restated.
    """

    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm

    list_display = ["email", "display_name", "site_count", "is_staff", "date_joined"]
    list_filter = ["is_staff", "is_superuser", "is_active"]
    search_fields = ["email", "display_name"]
    ordering = ["email"]
    readonly_fields = ["date_joined", "last_login"]

    fieldsets = [
        (None, {"fields": ["email", "password"]}),
        ("Profile", {"fields": ["display_name", "avatar"]}),
        (
            "Permissions",
            {
                "fields": [
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ]
            },
        ),
        ("Dates", {"fields": ["last_login", "date_joined"]}),
    ]

    add_fieldsets = [
        (
            None,
            {
                "classes": ["wide"],
                "fields": ["email", "display_name", "usable_password", "password1", "password2"],
            },
        )
    ]

    @admin.display(description="Blogs")
    def site_count(self, obj: User) -> int:
        return obj.sites.count()
