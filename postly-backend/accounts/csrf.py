"""
CSRF for the endpoints people use before they are signed in.

Django's CsrfViewMiddleware is in MIDDLEWARE, but it never sees a DRF view:
`APIView.as_view()` wraps every view in `csrf_exempt`, and DRF puts the check
back inside SessionAuthentication instead. That authenticator only runs it
once the session cookie has resolved to an active user — an anonymous
request returns from `authenticate()` before the check is reached. For
everything private that is fine, because an anonymous caller is refused with
a 401 anyway. For login, signup and the password-reset and resend flows it
meant no check at all: they are AllowAny, nobody is signed in when they are
used, and so any site could POST to them from a visitor's browser and have
the request treated exactly like one from our own frontend.

What that allowed, in order of how much it matters:

* **Login CSRF.** A page elsewhere submits the attacker's own email and
  password to /api/auth/login/. The victim's browser receives a Postly
  session for the attacker's account, and whatever they write next — a
  draft, a bio, their real address in settings — lands somewhere the
  attacker can read it. SameSite=Lax on the session cookie does not close
  this. Browsers refuse to store a Lax cookie from a cross-site fetch, but
  they do store one from a top-level navigation, and a plain HTML form
  that POSTs to /api/auth/login/ is exactly that — DRF parses form bodies
  as readily as JSON.
* Signups, reset emails and verification resends triggered from a third
  party's page, spread across its visitors' IP addresses and so across as
  many throttle buckets.
* A reset-confirm submitted on someone's behalf. Harmless without the uid
  and token from their inbox, but there is no reason to accept it.

The fix is to run the same check DRF runs for signed-in users, for every
request to these views, before anything else in `initial()` — before
authentication, permissions and throttling, the same place the middleware
would have run it. A forged request is refused before any credential is
looked at, and without spending the throttle budget of the visitor whose
browser was used to send it.

It is the stock Django check, so it enforces both halves: the Origin header
has to be the API's own host or one of CSRF_TRUSTED_ORIGINS, and the
X-CSRFToken header has to match the `csrftoken` cookie. lib/api.ts already
sends both — the cookie comes from GET /api/auth/csrf/, which AuthProvider
calls on mount, and the header is added to every unsafe request.

A mixin on the views rather than a change to CsrfSessionAuthentication: the
authenticator also runs for every anonymous request to a private endpoint,
and checking CSRF there would turn a missing token into a 403 ahead of the
401 that tells the frontend to send the visitor to /login.

Not in the list, deliberately:

* VerifyEmailView, which is a GET. CSRF does not apply to safe methods, and
  what stops a forged confirmation is the key in the path, which only the
  inbox has.
* Logout, password change and user details. They are only meaningful with
  a session, and with a session SessionAuthentication already checks.
* The public subscribe endpoints in blog/. They are meant to be callable
  from a published blog with no Postly session and no cookies at all, and
  double opt-in is what protects them, not a token.
"""

from .authentication import CsrfSessionAuthentication


class EnforceCsrfMixin:
    """
    Put first in the bases of an AllowAny APIView that changes state.

    Reuses SessionAuthentication.enforce_csrf so the rejection is the same
    `{"detail": "CSRF Failed: …"}` 403 a signed-in user gets, rather than
    Django's HTML failure page. Safe methods pass straight through, as they
    do in the middleware, and so does Django's test client unless it was
    built with `enforce_csrf_checks=True`.
    """

    def initial(self, request, *args, **kwargs):
        CsrfSessionAuthentication().enforce_csrf(request)
        super().initial(request, *args, **kwargs)
