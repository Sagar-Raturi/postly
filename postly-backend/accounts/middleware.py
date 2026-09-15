from django.conf import settings

# Read by the Next.js middleware. Deliberately not httpOnly and deliberately
# not a credential: it carries no identity and grants nothing.
AUTH_HINT_COOKIE = "postly_auth"


class AuthHintCookieMiddleware:
    """
    Mirrors "somebody is logged in" into a cookie the frontend can read.

    The frontend needs a server-visible answer to "should I render the
    dashboard, or bounce to /login?" before React starts. Neither existing
    cookie can give it one:

    * `sessionid` is httpOnly, and — the part that actually bites — Django
      issues it to anonymous visitors too. allauth writes to the session
      during signup, so someone who has merely signed up carries a session
      cookie while being entirely unauthenticated. Treating its presence as
      "logged in" bounces them from /login to /dashboard, where the first
      API call 401s and sends them back to /login: an infinite loop.
    * `csrftoken` is set for everyone, logged in or not.

    So this sets a third cookie that tracks request.user, and clears it as
    soon as a request arrives unauthenticated — which includes the 401 from
    the frontend's own "who am I" call, so an expired session cleans up
    after itself on the way past.

    It is a hint for routing and nothing else. The API never reads it, and
    forging it gets you a dashboard shell with no data in it, because every
    endpoint still requires a real session.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        user = getattr(request, "user", None)
        authenticated = bool(user and user.is_authenticated)
        present = request.COOKIES.get(AUTH_HINT_COOKIE) == "1"

        if authenticated and not present:
            response.set_cookie(
                AUTH_HINT_COOKIE,
                "1",
                max_age=settings.SESSION_COOKIE_AGE,
                domain=settings.SESSION_COOKIE_DOMAIN,
                secure=settings.SESSION_COOKIE_SECURE,
                httponly=False,
                samesite=settings.SESSION_COOKIE_SAMESITE,
            )
        elif not authenticated and present:
            response.delete_cookie(
                AUTH_HINT_COOKIE,
                domain=settings.SESSION_COOKIE_DOMAIN,
                samesite=settings.SESSION_COOKIE_SAMESITE,
            )

        return response
