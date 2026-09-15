from rest_framework.permissions import BasePermission


class IsOwner(BasePermission):
    """
    Object-level check that the requesting user owns the record.

    The view says where the owner lives via `owner_lookup`, a dotted path
    walked from the object — "owner" on a Site, "site.owner" on a Post.

    This is defence in depth, not the primary control. Every viewset also
    filters its queryset by the requesting user, which is what makes another
    account's row a 404 instead of a 403: a permission check alone would
    confirm the record exists before refusing it.
    """

    message = "You do not own this record."

    def has_object_permission(self, request, view, obj) -> bool:
        owner = obj
        for attribute in getattr(view, "owner_lookup", "owner").split("."):
            owner = getattr(owner, attribute, None)
            if owner is None:
                return False

        return owner == request.user
