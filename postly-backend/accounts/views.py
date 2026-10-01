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

import logging

from allauth.account import app_settings as allauth_settings
from allauth.account.models import EmailAddress, EmailConfirmation, EmailConfirmationHMAC
from allauth.account.utils import complete_signup
from allauth.core import ratelimit
from allauth.core.exceptions import ImmediateHttpResponse
from dj_rest_auth.app_settings import api_settings
from dj_rest_auth.views import LoginView, PasswordResetConfirmView, PasswordResetView
from django.contrib.auth import logout
from django.db import transaction
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.debug import sensitive_post_parameters
from django.views.decorators.http import require_GET
from rest_framework import serializers, status
from rest_framework.generics import CreateAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .adapters import EmailNotSent
from .csrf import EnforceCsrfMixin
from .serializers import AvatarSerializer, EmailNotVerified, UserSerializer

logger = logging.getLogger(__name__)

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

# Says that nothing was kept, because that is the part that changes what the
# person does next: they can sign up again with the same address, rather
# than going looking for a login they do not have.
SIGNUP_EMAIL_FAILED = (
    "We couldn't send your confirmation email, so your account wasn't "
    "created. Please try again in a few minutes."
)


# The four views below, and ResendVerificationView, are used signed-out and
# so get no CSRF check from SessionAuthentication. EnforceCsrfMixin puts it
# back — see accounts/csrf.py for what was open without it.


# The login answer for a right password on an unconfirmed address. It tells
# the person what happens next, not only what went wrong.
EMAIL_NOT_VERIFIED = (
    "Your email address isn't confirmed yet. We've sent you a new "
    "confirmation link: follow it, then sign in."
)


class ThrottledLoginView(EnforceCsrfMixin, LoginView):
    """
    POST /api/auth/login/

    dj-rest-auth's login, plus a way out for an account whose address was
    never confirmed.

    Verification is mandatory, so such an account cannot sign in. Before
    this, the only way to a fresh link was a resend button reachable from
    the screen shown straight after signup. Somebody whose first email was
    lost, landed in spam, expired, or carried a broken link (production once
    built links from a misconfigured FRONTEND_URL) had no route back at all:
    signing up again said the address was taken, and signing in said it was
    not verified and nothing more. allauth's own login flow resends in this
    situation; this does the same.

    So a right password on an unconfirmed address sends a new link and
    answers 400 with `code: "email_not_verified"`, which the login form
    turns into the "check your inbox" screen. Only somebody who knows the
    password gets this far, which is also all dj-rest-auth's stock message
    revealed. The send shares allauth's per-address cooldown, one email in
    three minutes, so repeated attempts cannot flood the inbox; inside the
    cooldown the earlier link is still on its way and still good.
    """

    throttle_scope = "auth_login"

    def post(self, request, *args, **kwargs):
        try:
            return super().post(request, *args, **kwargs)
        except EmailNotVerified as exc:
            self.send_new_confirmation(exc.user)
            return Response(
                {"detail": EMAIL_NOT_VERIFIED, "code": "email_not_verified"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def send_new_confirmation(self, user) -> None:
        address = EmailAddress.objects.filter(
            user=user, email__iexact=user.email, verified=False
        ).first()
        if address is None:
            return

        # allauth keys this cooldown on the lowercased address, as signup's
        # rollback does when it clears it.
        if not ratelimit.consume(
            self.request._request, action="confirm_email", key=address.email.lower()
        ):
            return

        try:
            address.send_confirmation(self.request._request)
        except EmailNotSent:
            # The person still gets the same answer; the verify page they
            # land on can try again. The log is the record of why.
            logger.exception(
                "Could not send a confirmation email at login for address %s",
                address.pk,
            )


class ThrottledPasswordResetView(EnforceCsrfMixin, PasswordResetView):
    throttle_scope = "auth_password_reset"


class CsrfPasswordResetConfirmView(EnforceCsrfMixin, PasswordResetConfirmView):
    """
    dj-rest-auth's confirm view, unchanged but for the CSRF check. It keeps
    the shared `dj_rest_auth` throttle scope it always had.
    """


class SignupView(EnforceCsrfMixin, CreateAPIView):
    """
    POST /api/auth/signup/

    **If the confirmation email cannot be sent, the account is not created.**
    The User and its EmailAddress are written in the same transaction as the
    send, and an EmailNotSent rolls both back and answers 503 with a
    `detail` the signup form shows as it is.

    The other way round (keep the account, report success, let "resend
    verification" retry) was tried by accident in production, where
    ATOMIC_REQUESTS is off and nothing caught the error: the row was
    committed, the person saw a 500, and signing up again said the address
    was taken, for an account they could neither log into nor confirm.
    Quietly reporting success would only move that dead end to the "check
    your inbox" screen. When the send is failing for a reason that lasts,
    such as a mail provider refusing unverified recipients, every resend
    fails too, and verification is mandatory, so the account is useless
    until mail works again. A clear "try again later" with nothing left
    behind is the honest answer, and the retry starts from scratch.

    A 503 here discloses nothing: this endpoint already says, as a 400, when
    an address has an account, and a failed send says nothing about anyone
    else's.

    Two edge cases, both acceptable:

    * A send that timed out after the provider accepted it still delivers
      the email. Its link then points at an EmailAddress that was rolled
      back, and the verify page reports it as used or expired. Signing up
      again sends a working one.
    * allauth spends a per-address cooldown (EMAIL_CONFIRMATION_COOLDOWN,
      three minutes) *before* it sends, and it lives in the cache, outside
      the transaction. Left alone, a retry inside those three minutes would
      create the account and skip the email without an error, which is
      worse than the original bug. So the cooldown is cleared along with
      the rollback.
    """

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

        try:
            with transaction.atomic():
                user = serializer.save(request._request)

                # Sends the confirmation mail. Verification is mandatory, so
                # it does not log the new account in — that has to wait for
                # the link.
                try:
                    complete_signup(
                        request._request, user, allauth_settings.EMAIL_VERIFICATION, None
                    )
                except ImmediateHttpResponse:
                    # allauth signals "stop and return this redirect" this
                    # way. There is nowhere to redirect a JSON client to, and
                    # the mail has gone, so the signup has in fact succeeded.
                    pass
        except EmailNotSent:
            # `exception` so the provider's own error survives into the logs
            # as this one's cause. It is the only record of why signups are
            # failing.
            logger.exception("Signup rolled back: the confirmation email was not sent")
            # allauth keys the cooldown on the lowercased address.
            ratelimit.clear(
                request._request,
                action="confirm_email",
                key=serializer.validated_data["email"].lower(),
            )
            return Response(
                {"detail": SIGNUP_EMAIL_FAILED},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {"detail": "Verification email sent."}, status=status.HTTP_201_CREATED
        )


class ResendVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResendVerificationView(EnforceCsrfMixin, APIView):
    """
    POST /api/auth/resend-verification/

    The "check your inbox" screen would otherwise be a dead end for anyone
    whose mail went astray.

    A failed send is logged and answered with the usual VERIFICATION_SENT,
    unlike signup's 503. Only an unverified address that exists triggers a
    send, so an error that only a send can produce would tell a caller that
    the address has an unconfirmed account here, which is the one thing
    this response is worded to keep quiet about.
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
            try:
                address.send_confirmation(request._request)
            except EmailNotSent:
                logger.exception(
                    "Could not resend the confirmation email for address %s", address.pk
                )

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


class AvatarView(APIView):
    """
    POST /api/auth/user/avatar/ — set the signed-in writer's picture.
    DELETE /api/auth/user/avatar/ — remove it.

    Separate from the user-details endpoint, which speaks JSON and cannot
    carry a file, and separate from a `PATCH` with a null field, which is a
    confusing way to spell "delete this". Both verbs answer with the whole
    account, the same shape `GET /api/auth/user/` returns, so the frontend
    can drop the response straight into its auth state.

    There is no user id in the path and none is accepted in the body: the
    only account this view can touch is `request.user`. That is what makes
    "a writer can only change their own avatar" a property of the URL rather
    than a permission check someone could forget to write.
    """

    parser_classes = [MultiPartParser, FormParser]
    throttle_scope = "avatar"

    def post(self, request):
        serializer = AvatarSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response(UserSerializer(user, context={"request": request}).data)

    def delete(self, request):
        user = request.user

        if user.avatar:
            # Drops the file as well as the column, so removing a picture
            # actually unpublishes it rather than just unlinking it.
            user.avatar.delete(save=True)

        # 200 with the account, not 204: the client needs the new state, and
        # a bare 204 would make it guess.
        return Response(UserSerializer(user, context={"request": request}).data)


class DeleteAccountSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("That password is not right.")
        return value


class DeleteAccountView(APIView):
    """
    POST /api/auth/user/delete/ — close the signed-in writer's account.

    Takes the current password. A session on its own is not enough, because
    this is the one action nothing can undo: a laptop left open, or a
    session cookie lifted by some other bug, should not be able to erase a
    writer's blog, their posts and their readers' subscriptions in one
    request. The password check also shares the login throttle, so a stolen
    session cannot be used to guess the password here either.

    POST rather than DELETE on `/api/auth/user/`: that path belongs to
    dj-rest-auth's details view, and a DELETE with a password in its body is
    something plenty of proxies and clients drop on the floor.

    What goes, and how:

    * the account row, and through `on_delete=CASCADE` every Site it owns,
      every Post on them, every Subscriber and every queued PostEmail —
      which also means a notification still waiting out its delay is never
      sent;
    * the avatar *file*, explicitly. Deleting a row does not delete the
      file its ImageField points at, and a picture left in MEDIA_ROOT is
      still being served at its old URL;
    * the session, via logout(), so the response also clears the
      `postly_auth` hint cookie on its way out (AuthHintCookieMiddleware
      sees an anonymous request.user).

    Answers 204. There is nothing left to describe.
    """

    throttle_scope = "auth_login"

    @method_decorator(sensitive_post_parameters("password"))
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def post(self, request):
        serializer = DeleteAccountSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        user = request.user

        if user.avatar:
            user.avatar.delete(save=False)

        logout(request._request)
        user.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


@require_GET
@ensure_csrf_cookie
def csrf_token_view(request):
    """
    Hands the frontend a CSRF cookie.

    Needed before the first unsafe request of any kind, including the
    signed-out ones — login and signup are CSRF-checked too, see csrf.py.
    AuthProvider calls this on mount, and lib/api.ts calls it again whenever
    it is about to send an unsafe request and finds no cookie, so a visitor
    who clears cookies mid-session is not left with every request 403ing.
    Logging in rotates the token (django.contrib.auth.login), and the new
    cookie comes back on that response.
    """
    return JsonResponse({"detail": "CSRF cookie set."})
