"""
The avatar upload endpoint.

Three properties are load-bearing and each has its own class below:

* the endpoint acts on `request.user` and on nobody else;
* what reaches disk is Pillow's output, bounded in bytes and in pixels,
  never the caller's bytes;
* the URL handed to a reader is absolute, because the blog that renders it
  is served from a different origin.
"""

from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from accounts.avatars import AVATAR_SIZE, MAX_UPLOAD_BYTES

pytestmark = pytest.mark.django_db

AVATAR_URL = "/api/auth/user/avatar/"
USER_URL = "/api/auth/user/"


def stored(user):
    """Re-read the avatar column from the database."""
    user.refresh_from_db()
    return user.avatar


def dimensions(field) -> tuple[int, int]:
    with field.open("rb") as handle:
        return Image.open(BytesIO(handle.read())).size


class TestUpload:
    def test_a_writer_can_set_their_own_avatar(self, api_a, user_a, make_image):
        response = api_a.post(AVATAR_URL, {"avatar": make_image()}, format="multipart")

        assert response.status_code == 200
        assert stored(user_a)
        # The response is the whole account, so the client can use it
        # directly as the new auth state.
        assert response.json()["email"] == user_a.email
        assert response.json()["avatar"]

    def test_the_stored_file_is_a_square_thumbnail(self, api_a, user_a, make_image):
        api_a.post(
            AVATAR_URL, {"avatar": make_image(size=(3000, 2000))}, format="multipart"
        )

        assert dimensions(stored(user_a)) == (AVATAR_SIZE, AVATAR_SIZE)

    def test_a_large_photo_is_not_served_as_uploaded(self, api_a, user_a, make_image):
        """The reason this endpoint re-encodes at all."""
        upload = make_image(size=(4000, 3000))

        api_a.post(AVATAR_URL, {"avatar": upload}, format="multipart")

        assert stored(user_a).size < upload.size

    def test_a_small_image_is_not_blown_up(self, api_a, user_a, make_image):
        api_a.post(AVATAR_URL, {"avatar": make_image(size=(64, 64))}, format="multipart")

        assert dimensions(stored(user_a)) == (64, 64)

    def test_a_transparent_png_stays_transparent(self, api_a, user_a, make_image):
        api_a.post(
            AVATAR_URL,
            {
                "avatar": make_image(
                    fmt="PNG", name="logo.png", content_type="image/png"
                )
            },
            format="multipart",
        )

        with stored(user_a).open("rb") as handle:
            assert Image.open(BytesIO(handle.read())).mode == "RGBA"

    def test_the_uploaded_filename_is_discarded(self, api_a, user_a, make_image):
        """It is attacker-controlled and sometimes revealing."""
        api_a.post(
            AVATAR_URL,
            {"avatar": make_image(name="passport-scan.jpg")},
            format="multipart",
        )

        name = stored(user_a).name
        assert name.startswith("avatars/")
        assert "passport-scan" not in name

    def test_replacing_an_avatar_removes_the_old_file(self, api_a, user_a, make_image):
        api_a.post(AVATAR_URL, {"avatar": make_image()}, format="multipart")
        first = stored(user_a)
        first_name = first.name

        api_a.post(AVATAR_URL, {"avatar": make_image()}, format="multipart")

        assert stored(user_a).name != first_name
        assert not first.storage.exists(first_name)


class TestRejectedUploads:
    def test_an_oversized_file_is_rejected(self, api_a, user_a):
        oversized = SimpleUploadedFile(
            "huge.jpg", b"x" * (MAX_UPLOAD_BYTES + 1), content_type="image/jpeg"
        )

        response = api_a.post(AVATAR_URL, {"avatar": oversized}, format="multipart")

        assert response.status_code == 400
        assert "MB" in str(response.json())
        assert not stored(user_a)

    def test_a_non_image_is_rejected(self, api_a, user_a):
        text = SimpleUploadedFile(
            "notes.txt", b"just some text", content_type="text/plain"
        )

        response = api_a.post(AVATAR_URL, {"avatar": text}, format="multipart")

        assert response.status_code == 400
        assert not stored(user_a)

    def test_a_non_image_wearing_an_image_content_type_is_rejected(self, api_a, user_a):
        """
        The content type is a string the client chose, so it cannot be the
        check that matters. Pillow failing to decode is.
        """
        disguised = SimpleUploadedFile(
            "avatar.png",
            b"<html><script>alert(1)</script></html>",
            content_type="image/png",
        )

        response = api_a.post(AVATAR_URL, {"avatar": disguised}, format="multipart")

        assert response.status_code == 400
        assert not stored(user_a)

    def test_an_svg_is_rejected(self, api_a, user_a):
        """SVG is a script container, and it is not in ALLOWED_FORMATS."""
        svg = SimpleUploadedFile(
            "logo.svg",
            b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
            content_type="image/svg+xml",
        )

        response = api_a.post(AVATAR_URL, {"avatar": svg}, format="multipart")

        assert response.status_code == 400
        assert not stored(user_a)

    def test_an_empty_file_is_rejected(self, api_a, user_a):
        empty = SimpleUploadedFile("nothing.jpg", b"", content_type="image/jpeg")

        response = api_a.post(AVATAR_URL, {"avatar": empty}, format="multipart")

        assert response.status_code == 400
        assert not stored(user_a)

    def test_a_missing_field_is_a_400(self, api_a):
        assert api_a.post(AVATAR_URL, {}, format="multipart").status_code == 400

    def test_a_rejected_upload_leaves_an_existing_avatar_alone(
        self, api_a, user_a, make_image
    ):
        api_a.post(AVATAR_URL, {"avatar": make_image()}, format="multipart")
        before = stored(user_a).name

        api_a.post(
            AVATAR_URL,
            {"avatar": SimpleUploadedFile("x.jpg", b"nope", content_type="image/jpeg")},
            format="multipart",
        )

        assert stored(user_a).name == before


class TestOnlyYourOwn:
    """
    There is no user id anywhere in this endpoint — not in the path, not in
    the body — so the only account it can reach is the caller's.
    """

    def test_anonymous_callers_are_turned_away(self, api, user_a, make_image):
        response = api.post(AVATAR_URL, {"avatar": make_image()}, format="multipart")

        assert response.status_code == 401
        assert not stored(user_a)

    def test_one_writer_cannot_set_another_writers_avatar(
        self, api_b, user_a, user_b, make_image
    ):
        api_b.post(AVATAR_URL, {"avatar": make_image()}, format="multipart")

        assert stored(user_b)
        assert not stored(user_a)

    def test_a_smuggled_user_field_is_ignored(self, api_b, user_a, user_b, make_image):
        """The obvious thing to try: name the victim in the body."""
        response = api_b.post(
            AVATAR_URL,
            {"avatar": make_image(), "user": user_a.pk, "id": user_a.pk},
            format="multipart",
        )

        assert response.status_code == 200
        assert response.json()["id"] == user_b.pk
        assert not stored(user_a)

    def test_one_writer_cannot_delete_another_writers_avatar(
        self, api_a, api_b, user_a, make_image
    ):
        api_a.post(AVATAR_URL, {"avatar": make_image()}, format="multipart")

        assert api_b.delete(AVATAR_URL).status_code == 200

        assert stored(user_a)


class TestRemoval:
    def test_delete_clears_the_field_and_the_file(self, api_a, user_a, make_image):
        api_a.post(AVATAR_URL, {"avatar": make_image()}, format="multipart")
        uploaded = stored(user_a)
        uploaded_name = uploaded.name

        response = api_a.delete(AVATAR_URL)

        assert response.status_code == 200
        assert response.json()["avatar"] is None
        assert not stored(user_a)
        assert not uploaded.storage.exists(uploaded_name)

    def test_delete_with_no_avatar_is_not_an_error(self, api_a):
        """The button should be safe to press twice."""
        assert api_a.delete(AVATAR_URL).status_code == 200

    def test_delete_is_refused_to_anonymous_callers(self, api):
        assert api.delete(AVATAR_URL).status_code == 401


class TestUserEndpoint:
    def test_the_account_carries_an_absolute_avatar_url(self, api_a, make_image):
        api_a.post(AVATAR_URL, {"avatar": make_image()}, format="multipart")

        avatar = api_a.get(USER_URL).json()["avatar"]

        assert avatar.startswith("http://")
        assert "/media/avatars/" in avatar

    def test_the_avatar_is_null_before_one_is_set(self, api_a):
        assert api_a.get(USER_URL).json()["avatar"] is None

    def test_the_avatar_cannot_be_set_through_the_json_endpoint(self, api_a, user_a):
        """
        It is in `read_only_fields` there. A string sent to that endpoint
        would otherwise be written straight into the column as a path.
        """
        response = api_a.patch(
            USER_URL, {"avatar": "avatars/someone-elses.jpg"}, format="json"
        )

        assert response.status_code == 200
        assert not stored(user_a)
