"""
Auth endpoints.

Login, logout, user details and the password flows are dj-rest-auth's,
subclassed only to give each one its own throttle scope — dj-rest-auth puts
every view under a single shared `dj_rest_auth` scope, which would let failed
logins eat the budget for password resets and vice versa.

Signup and resend-verification are written out here rather than imported.
`dj_rest_auth.registration.views` imports `allauth.socialaccount.models` at
module scope, so importing it would mean installing the whole social-login
subsystem — three unused tables and an admin section — for a product that
has no social login. The app itself stays in INSTALLED_APPS, because that is
what switches on dj-rest-auth's check that an address is verified before it
lets anyone log in.
"""

from allauth.account import app_settings as allauth_settings
from allauth.account.models import EmailAddress, EmailConfirmation, EmailConfirmationHMAC
from allauth.account.utils import complete_signup
from allauth.core.exceptions import ImmediateHttpResponse
from dj_rest_auth.app_settings import api_settings
from dj_rest_auth.views import LoginView, PasswordResetView
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.debug import sensitive_post_parameters
from django.views.decorators.http import require_GET
from rest_framework import serializers, status
from rest_framework.generics import CreateAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

# Deliberately covers three cases in one sentence. allauth's HMAC keys carry
# no server-side state and its lookup filters on verified=False, so a link
# that has already been used is indistinguishable from one that never was
# valid. Telling people to try logging in first costs nothing and is the
# right advice for the common case: a second click on the same link.
INVALID_KEY = (
    "This link has already been used, or it has expired. "
    "Try logging in, or ask for a new link."
)

# Sent whether or not the address is one we know, so neither endpoint can be
# used to work out who has an account here.
VERIFICATION_SENT = "If that address needs confirming, a new link is on its way."


class ThrottledLoginView(LoginView):
    throttle_scope = "auth_login"


class ThrottledPasswordResetView(PasswordResetView):
    throttle_scope = "auth_password_reset"


class SignupView(CreateAPIView):
    """POST /api/auth/signup/"""

    serializer_class = api_settings.REGISTER_SERIALIZER
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "auth_signup"

    @method_decorator(sensitive_post_parameters("password1", "password2"))
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.save(request._request)

        # Sends the confirmation mail. Verification is mandatory, so it does
        # not log the new account in — that has to wait for the link.
        try:
            complete_signup(
                request._request, user, allauth_settings.EMAIL_VERIFICATION, None
            )
        except ImmediateHttpResponse:
            # allauth signals "stop and return this redirect" this way. There
            # is nowhere to redirect a JSON client to, and the account is
            # already created, so the signup has in fact succeeded.
            pass

        return Response(
            {"detail": "Verification email sent."}, status=status.HTTP_201_CREATED
        )


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResendVerificationView(APIView):
    """
    POST /api/auth/resend-verification/

    The "check your inbox" screen would otherwise be a dead end for anyone
    whose mail went astray.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "auth_password_reset"

    def post(self, request):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        address = EmailAddress.objects.filter(
            email__iexact=serializer.validated_data["email"], verified=False
        ).first()
        if address is not None:
            address.send_confirmation(request._request)

        return Response({"detail": VERIFICATION_SENT})


class VerifyEmailView(APIView):
    """
    GET /api/auth/verify-email/{key}/

    dj-rest-auth's own verify-email view is POST-only with the key in the
    body. A GET with the key in the path is what the link in the email can
    hand to the frontend, which calls this directly.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "auth_verify_email"

    def get(self, request, key: str):
        confirmation = self._confirmation(key)
        if confirmation is None:
            return Response({"detail": INVALID_KEY}, status=status.HTTP_400_BAD_REQUEST)

        email_address = confirmation.email_address

        # Only reachable on the stored-confirmation path: the HMAC lookup
        # above already excludes verified addresses.
        if email_address.verified:
            return Response(
                {"detail": "That address is already confirmed.", "email": email_address.email}
            )

        # confirm() returns None when the key has aged out.
        if confirmation.confirm(request._request) is None:
            return Response({"detail": INVALID_KEY}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {"detail": "Your email address is confirmed.", "email": email_address.email}
        )

    @staticmethod
    def _confirmation(key: str):
        """Resolve either an HMAC key (the default) or a stored one."""
        confirmation = EmailConfirmationHMAC.from_key(key)
        if confirmation is not None:
            return confirmation

        try:
            return EmailConfirmation.objects.get(key=key.lower())
        except (EmailConfirmation.DoesNotExist, EmailAddress.DoesNotExist):
            return None


@require_GET
@ensure_csrf_cookie
def csrf_token_view(request):
    """
    Hands the frontend a CSRF cookie.

    Logging in refreshes the cookie on its own (django.contrib.auth.login
    rotates the token), so this is the recovery path: if a visitor clears
    cookies mid-session, every unsafe request would 403 with no way back.
    AuthProvider calls this on mount.
    """
    return JsonResponse({"detail": "CSRF cookie set."})
