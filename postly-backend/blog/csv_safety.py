"""
Making a CSV cell safe to open in a spreadsheet.

A CSV is data, and Excel, LibreOffice and Google Sheets all treat a cell
beginning `=`, `+`, `-` or `@` as a *formula* rather than as text. So a
value that arrived from the internet and gets written into an export
becomes code the moment the person who downloaded it double-clicks the
file. The classic payloads call `WEBSERVICE()` to exfiltrate the rest of
the sheet, or `cmd|'/c ...'` through DDE.

The reflex is "an email address can't start with `=`", and it is wrong.
RFC 5322's `atext` — the unquoted local part — includes `=`, `+`, `-` and
plenty else, so `=cmd|'/c calc'!A1@example.com` passes Django's
EmailValidator and would pass any other spec-abiding one. The subscribe
form accepts addresses from strangers, and the writer's export is where
those addresses land, which is exactly the shape this attack needs:
untrusted in one place, opened in a spreadsheet somewhere else.

The fix is a leading apostrophe, which every spreadsheet reads as "the
rest of this is text" and shows to nobody. It is one character and it is
the whole defence; escaping the characters individually does not work,
because it is the *first* character that decides how the cell is parsed.
"""

# Also \t, \r and \n: a cell starting with whitespace can be trimmed back
# into one of the four by the spreadsheet before it decides what it is.
DANGEROUS_PREFIXES = ("=", "+", "-", "@", "\t", "\r", "\n")


def csv_safe(value) -> str:
    """
    One cell, rendered so a spreadsheet treats it as text.

    Everything non-string becomes a string first — a caller passing a
    datetime or None should get "" or an ISO string rather than a crash
    halfway through writing a file that has already started streaming.
    """
    text = "" if value is None else str(value)

    if text.startswith(DANGEROUS_PREFIXES):
        return f"'{text}"

    return text
