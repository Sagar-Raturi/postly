"""
Sanitising stored post HTML on its way out to readers.

A post body is HTML the writer's editor produced, stored verbatim so it can
be loaded back into the editor unchanged. That is fine while it is only ever
rendered back to its own author. It stops being fine the moment it is
rendered to other people on a Postly origin: until Phase 3 gives every blog
its own subdomain, a published blog is served from the same origin as the
dashboard, so a `<script>` in somebody's post would run with the reading
writer's own session behind it.

So the public serializers run bodies through `clean()`. Two consequences
worth being explicit about:

* it is done on the way **out**, not on the way in. Stored content is never
  rewritten, so this also covers everything written before this existed, and
  an over-strict allowlist here can be loosened without a data migration;
* the dashboard's own API is untouched. A writer's editor gets their markup
  back byte for byte, and what they can do to themselves in their own
  dashboard is their business.

The allowlist is what the TipTap editor can actually produce, plus the few
tags a paste might legitimately bring in. Anything else — `<script>`,
`<style>`, `<iframe>`, event handler attributes, `javascript:` URLs — is
dropped by nh3, which is a Rust HTML parser rather than a regex, and so is
not fooled by the usual malformed-markup tricks.
"""

import nh3

ALLOWED_TAGS = {
    # Blocks
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "blockquote",
    "pre",
    "hr",
    "ul",
    "ol",
    "li",
    "figure",
    "figcaption",
    # Inline
    "a",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "del",
    "code",
    "br",
    "span",
    "sub",
    "sup",
    "img",
}

ALLOWED_ATTRIBUTES = {
    # No "rel": nh3 manages it itself, from `link_rel` below, and refuses
    # to be given both.
    "a": {"href", "title", "target"},
    "img": {"src", "alt", "title", "width", "height", "loading"},
    # TipTap marks code blocks with a language class.
    "pre": {"class"},
    "code": {"class"},
}

# Anything not listed here is stripped from href/src, which is what removes
# `javascript:` and `data:text/html` links.
ALLOWED_URL_SCHEMES = {"http", "https", "mailto"}


def clean(html: str) -> str:
    """Return `html` with everything outside the allowlist removed."""
    if not html:
        return ""

    return nh3.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        url_schemes=ALLOWED_URL_SCHEMES,
        # Outbound links in reader-supplied content get rel="noopener", so a
        # linked page cannot reach back through window.opener.
        link_rel="noopener noreferrer",
    )
