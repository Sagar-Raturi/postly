"""
Deterministic lorem-ipsum bodies for `seed_dummy_posts`.

Generated rather than hand-written, because ten paragraphs of filler are not
worth reading in a diff — but seeded per post, so the same index always
produces the same body. That matters: `seed_dummy_posts` is idempotent, and a
body that changed between runs would make "already exists" and "was
re-created" indistinguishable.

Lengths vary from a couple of hundred words to nearly a thousand, and the
markup rotates through headings, lists and blockquotes, for the same reason
the curated posts do — so the prose styles and the read-time estimates are
exercised against variation rather than against one shape repeated ten times.
"""

import random

WORDS = (
    "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod "
    "tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam "
    "quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo "
    "consequat duis aute irure in reprehenderit voluptate velit esse cillum "
    "eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident "
    "sunt culpa qui officia deserunt mollit anim id est laborum"
).split()

# How many paragraphs each post gets, cycled by index. Deliberately uneven:
# a run of identical lengths would tell you nothing about truncation.
PARAGRAPH_COUNTS = [3, 6, 4, 9, 3, 7, 5, 11, 4, 8]


def _sentence(rng: random.Random) -> str:
    words = rng.sample(WORDS, rng.randint(6, 14))
    return f"{' '.join(words).capitalize()}."


def _paragraph(rng: random.Random) -> str:
    sentences = " ".join(_sentence(rng) for _ in range(rng.randint(3, 6)))
    return f"<p>{sentences}</p>"


def _heading(rng: random.Random) -> str:
    words = rng.sample(WORDS, 3)
    return f"<h2>{' '.join(words).capitalize()}</h2>"


def _list(rng: random.Random) -> str:
    items = "".join(
        f"<li>{' '.join(rng.sample(WORDS, rng.randint(4, 9))).capitalize()}</li>"
        for _ in range(rng.randint(3, 5))
    )
    return f"<ul>{items}</ul>"


def _quote(rng: random.Random) -> str:
    return f"<blockquote><p>{_sentence(rng)}</p></blockquote>"


def dummy_body(index: int) -> str:
    """
    The HTML body for filler post `index` (1-based).

    Seeded from the index, so the same post always gets the same text.
    """
    rng = random.Random(index)
    paragraphs = PARAGRAPH_COUNTS[(index - 1) % len(PARAGRAPH_COUNTS)]

    # The opening is fixed, so a filler body is recognisable as filler from
    # its first three words — in an excerpt, in a card, anywhere.
    parts = [
        "<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. "
        f"{_sentence(rng)} {_sentence(rng)}</p>"
    ]

    for position in range(1, paragraphs):
        # Rotate the block elements in rather than scattering them randomly,
        # so every third or fourth post reliably has a heading to style.
        if position == 2 and paragraphs >= 4:
            parts.append(_heading(rng))
        elif position == 4 and index % 2 == 0:
            parts.append(_list(rng))
        elif position == 3 and index % 3 == 0:
            parts.append(_quote(rng))

        parts.append(_paragraph(rng))

    return "".join(parts)
