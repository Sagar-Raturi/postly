"""
Turning whatever a browser uploaded into something safe to serve.

Nothing a person uploads is stored as it arrived. Every avatar is decoded,
re-oriented, cropped, resized and written out again by Pillow, which buys
three things at once:

* **Size.** A phone camera produces a 12-megapixel, four-megabyte JPEG. That
  would then be downloaded by every reader of the blog, to be drawn in a
  circle 56 pixels across.
* **Privacy.** Re-encoding drops the EXIF block, and phone EXIF routinely
  carries GPS coordinates. A writer adding a photo of themselves should not
  also be publishing where they took it.
* **Safety.** The bytes that reach disk are Pillow's output, not the
  caller's input. A file that is really an HTML document with a .png name
  never gets past `Image.open`, so it can never be served back from our
  origin as markup.

The size and type checks below run *before* decoding: `Image.open` reads
headers lazily, but `load()` allocates the whole bitmap, and a 40000x40000
PNG that zips to 200KB should be turned away on its dimensions rather than
on the gigabyte of memory it wants.
"""

import uuid
from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework import serializers

# 5MB. Comfortably above any reasonable portrait once the browser has
# finished with it, far below what an unbounded upload would cost us.
MAX_UPLOAD_BYTES = 5 * 1024 * 1024

# The largest source image worth decoding, in total pixels — roughly a 50MP
# photo. Pillow has its own DecompressionBombWarning at ~89MP; this is the
# same idea with a limit chosen for portraits rather than for astronomy.
MAX_SOURCE_PIXELS = 50_000_000

# What the stored avatar is scaled to: a square, at 2x the largest size the
# blog draws it at, so it stays sharp on a retina screen.
AVATAR_SIZE = 512

# The smallest a JPEG is decoded at, per side. Twice AVATAR_SIZE so the final
# LANCZOS pass still has real pixels to average — the same headroom Pillow's
# own Image.thumbnail() leaves with its default reducing_gap of 2.0.
DRAFT_SIZE = AVATAR_SIZE * 2

# Pillow's own names for the formats we accept. GIF is missing on purpose:
# it would either animate on a page that never asked for animation, or lose
# every frame but one without telling anyone.
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

# What a browser should have labelled those as. Checked as an early, cheap
# filter only — the format Pillow actually finds is what decides, because a
# content type is just a string the client chose.
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/pjpeg", "image/png", "image/webp"}

TOO_BIG = (
    f"That image is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)}MB. "
    "Try a smaller one."
)
NOT_AN_IMAGE = "That file is not a JPEG, PNG or WebP image."


def process(upload) -> ContentFile:
    """
    Validate an uploaded file and return the square avatar to store.

    Raises DRF's ValidationError — this is called from a serializer, and the
    messages are written to be shown to the person who picked the file.
    """
    if upload.size > MAX_UPLOAD_BYTES:
        raise serializers.ValidationError(TOO_BIG)

    # An empty file has no headers to read and would otherwise fail deeper
    # in Pillow with a message about truncation.
    if not upload.size:
        raise serializers.ValidationError(NOT_AN_IMAGE)

    content_type = (getattr(upload, "content_type", "") or "").split(";")[0].strip()
    if content_type and content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise serializers.ValidationError(NOT_AN_IMAGE)

    upload.seek(0)

    try:
        image = Image.open(upload)
        # Reads the header only. `format` is set from the magic bytes, so
        # this is the check that a .png really is one.
        if image.format not in ALLOWED_FORMATS:
            raise serializers.ValidationError(NOT_AN_IMAGE)

        width, height = image.size
        if width * height > MAX_SOURCE_PIXELS:
            raise serializers.ValidationError(TOO_BIG)

        # Decode a JPEG at 1/2, 1/4 or 1/8 scale rather than in full. The
        # decoder does this itself, so the full-size bitmap is never built.
        #
        # A 48MP phone photo is 137MB per copy decoded, and orientation and
        # mode conversion below can hold two or three copies at once — on a
        # 512MB instance that is enough to get the worker killed mid-upload,
        # all to produce a 512px square. Decoded at 1/4 it is under 9MB.
        #
        # Pillow picks the largest scale that keeps *both* sides at or above
        # DRAFT_SIZE, so the square crop in _render never runs short. A no-op
        # for PNG and WebP, which have no reduced-size decode.
        #
        # After the pixel check on purpose: MAX_SOURCE_PIXELS has to judge
        # the image the caller sent, not the smaller one decoded here.
        image.draft(None, (DRAFT_SIZE, DRAFT_SIZE))

        # Only now is the bitmap allocated.
        image.load()
    except serializers.ValidationError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        # OSError covers a truncated file; ValueError, a malformed one.
        raise serializers.ValidationError(NOT_AN_IMAGE)

    return _render(image)


def _render(image: Image.Image) -> ContentFile:
    """Square, downscaled, re-encoded — the file that actually gets stored."""
    # A photo taken sideways carries its rotation in EXIF, and re-encoding
    # is about to drop EXIF. Apply it first, or portraits land on their side.
    image = _transpose(image)

    has_alpha = image.mode in ("RGBA", "LA", "PA") or "transparency" in image.info
    image = image.convert("RGBA" if has_alpha else "RGB")

    image = _square(image)

    # Only ever downscale. Blowing a 64px image up to 512 would not add
    # detail, just bytes.
    if image.width > AVATAR_SIZE:
        image = image.resize((AVATAR_SIZE, AVATAR_SIZE), Image.LANCZOS)

    buffer = BytesIO()
    if has_alpha:
        image.save(buffer, format="PNG", optimize=True)
        suffix = "png"
    else:
        # `quality=85` is the usual sweet spot; `progressive` makes a slow
        # connection show a whole blurry face rather than a sharp forehead.
        image.save(buffer, format="JPEG", quality=85, optimize=True, progressive=True)
        suffix = "jpg"

    return ContentFile(buffer.getvalue(), name=f"{uuid.uuid4().hex}.{suffix}")


def _transpose(image: Image.Image) -> Image.Image:
    try:
        return ImageOps.exif_transpose(image)
    except Exception:
        # A corrupt EXIF block is not a reason to reject an image that
        # otherwise decoded fine; it just means we cannot un-rotate it.
        return image


def _square(image: Image.Image) -> Image.Image:
    """Centre-crop to a square, which is how every avatar here is drawn."""
    side = min(image.size)
    left = (image.width - side) // 2
    top = (image.height - side) // 2
    return image.crop((left, top, left + side, top + side))
