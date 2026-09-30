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

    CSRF enforcement is inherited unchanged, and that is narrower than it
    looks: SessionAuthentication checks the token on unsafe methods only
    once the session has resolved to an active user. An anonymous request
    gets no check here at all — which is right for private endpoints, since
    it is refused with a 401 anyway, and wrong for the signed-out ones
    (login, signup, password reset). Those carry EnforceCsrfMixin from
    accounts/csrf.py instead.
    """

    def authenticate_header(self, request) -> str:
        return 'Session realm="api"'
