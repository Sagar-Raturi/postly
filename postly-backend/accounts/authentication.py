from rest_framework.authentication import SessionAuthentication


class CsrfSessionAuthentication(SessionAuthentication):
    """
    Session auth that answers anonymous requests with 401 rather than 403.

    DRF downgrades NotAuthenticated (401) to PermissionDenied (403) whenever
    no authenticator offers a `WWW-Authenticate` header, and the stock
    SessionAuthentication offers none. That reads as "you are logged in but
    may not do this", which is the wrong signal for the frontend: a 401 is
    what tells it to clear its auth state and send the visitor to /login.

    The scheme is deliberately `Session` and not `Basic` — a Basic challenge
    would make the browser pop its own credentials dialog over our UI.

    CSRF enforcement is inherited unchanged: SessionAuthentication checks the
    token on unsafe methods for anyone carrying a session cookie.
    """

    def authenticate_header(self, request) -> str:
        return 'Session realm="api"'
