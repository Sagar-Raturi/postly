from django.urls import include, path, re_path
from django.views.generic import TemplateView

from .views import (
    AvatarView,
    ResendVerificationView,
    SignupView,
    ThrottledLoginView,
    ThrottledPasswordResetView,
    VerifyEmailView,
    csrf_token_view,
)

urlpatterns = [
    # Our throttled views have to be listed before dj_rest_auth.urls, which
    # registers the unthrottled originals at the same paths.
    path("signup/", SignupView.as_view(), name="rest_register"),
    path("login/", ThrottledLoginView.as_view(), name="rest_login"),
    path("password/reset/", ThrottledPasswordResetView.as_view(), name="rest_password_reset"),
    path(
        "resend-verification/",
        ResendVerificationView.as_view(),
        name="rest_resend_email",
    ),
    path("verify-email/<str:key>/", VerifyEmailView.as_view(), name="rest_verify_email_key"),
    path("csrf/", csrf_token_view, name="csrf_token"),
    # Above dj_rest_auth.urls for the same reason as the views above it:
    # `user/` is registered there, and Django takes the first match.
    path("user/avatar/", AvatarView.as_view(), name="user_avatar"),
    # logout, user, password/change and password/reset/confirm.
    path("", include("dj_rest_auth.urls")),
    # allauth reverses these two internally while completing a signup. They
    # render nothing: every page a person sees lives in the Next.js app.
    re_path(
        r"^account-confirm-email/(?P<key>[-:\w]+)/$",
        TemplateView.as_view(template_name="account/blank.html"),
        name="account_confirm_email",
    ),
    path(
        "account-email-verification-sent/",
        TemplateView.as_view(template_name="account/blank.html"),
        name="account_email_verification_sent",
    ),
]
