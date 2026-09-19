"""
The anonymous, read-only half of the API — what the published blog reads.

Every view here is `AllowAny`, which is the opposite of the project default
(see REST_FRAMEWORK in settings: an endpoint that says nothing is private).
That is deliberate and it is the point of this module: these three URLs are
the only ones a reader with no Postly account ever touches, so keeping them
in one file makes the public surface something you can read end to end.

Three rules hold across all of them:

* only published posts exist — a draft is a 404, not a 403, so the public
  API never confirms that an unpublished post is there;
* the serializers come from public_serializers.py, which lists public fields
  explicitly rather than excluding private ones;
* nothing is scoped by `request.user`, because there is not one.
"""

from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .emails import send_subscription_confirmation
from .models import Post, Site, Subscriber
from .public_serializers import (
    PublicPostListSerializer,
    PublicPostSerializer,
    PublicSiteSerializer,
    SubscribeSerializer,
    SubscriptionSerializer,
)
from .subscriptions import (
    InvalidConfirmToken,
    confirm_subscriber,
    read_confirm_token,
    unsubscribe_subscriber,
)


def published_posts(site_slug: str):
    """
    Everything a reader of `site_slug` is allowed to see.

    The status filter lives here, once, rather than in each view — it is the
    single line standing between a draft and the internet.
    """
    site = get_object_or_404(Site, slug=site_slug)
    return (
        Post.objects.filter(site=site, status=Post.Status.PUBLISHED)
        .select_related("author")
        .order_by("-published_at", "-id")
    )


class PublicSiteView(RetrieveAPIView):
    """GET /api/public/sites/{slug}/ — the blog's name, description, author."""

    permission_classes = [AllowAny]
    serializer_class = PublicSiteSerializer
    queryset = Site.objects.select_related("owner")
    lookup_field = "slug"


class PublicPostListView(ListAPIView):
    """
    GET /api/public/sites/{slug}/posts/ — published posts, newest first.

    Paginated by the project default (PAGE_SIZE 20, `?page=`).
    """

    permission_classes = [AllowAny]
    serializer_class = PublicPostListSerializer
    # Neither filtering nor ordering is client-controllable here: a reader
    # choosing the ordering is not a feature, and `?status=` would be a way
    # to ask for drafts.
    filter_backends = []

    def get_queryset(self):
        return published_posts(self.kwargs["slug"])


class PublicPostDetailView(RetrieveAPIView):
    """
    GET /api/public/sites/{slug}/posts/{post_slug}/ — one published post.

    A draft's slug 404s here, which is what the frontend renders as
    "not found" rather than leaking that the post exists in someone's
    dashboard.
    """

    permission_classes = [AllowAny]
    serializer_class = PublicPostSerializer
    lookup_url_kwarg = "post_slug"
    lookup_field = "slug"

    def get_queryset(self):
        return published_posts(self.kwargs["slug"])


# ---------------------------------------------------------------------- #
# Subscriptions
#
# The three endpoints below are the only *writable* public surface on
# Postly, so two properties hold across all of them.
#
# **They carry no authentication at all.** `authentication_classes = []`
# rather than the project default, and this is load-bearing rather than
# tidy-minded. The default is CsrfSessionAuthentication, which enforces
# CSRF on unsafe methods for anybody holding a session cookie — so a
# logged-in writer opening their own blog in the same browser would have
# their subscribe POST rejected as a CSRF failure, while a signed-out
# reader beside them succeeded. Emptying the list makes every caller here
# anonymous, which is what they all are conceptually anyway: none of these
# views ever looks at request.user.
#
# **They never confirm or deny that an address is on a list.** Subscribe
# answers identically for a new address, a pending one and a confirmed
# one; the token endpoints answer identically for a forged token, an
# expired one and one naming a row that no longer exists. Any difference
# turns a public endpoint into a way of asking who reads somebody's blog.
# ---------------------------------------------------------------------- #

# Said to everyone who submits the form, whatever was actually done with
# the row behind it — created, left alone, or discarded as a bot.
SUBSCRIBE_MESSAGE = "Check your inbox for a link to confirm your subscription."

# Said for every kind of bad token. See read_confirm_token on why there is
# only one message.
INVALID_TOKEN_MESSAGE = "That link is not valid any more. Try subscribing again."


def _token_from(request) -> str:
    """
    The token, from the body or the query string.

    Both, because the two callers of these endpoints want different
    places. The blog's own pages POST JSON. A mail client acting on
    List-Unsubscribe-Post (RFC 8058, Phase 4) POSTs a fixed form body of
    its own choosing to a URL we supplied, so the only place we can put
    the token is that URL.
    """
    return (
        request.data.get("token") or request.query_params.get("token") or ""
    ).strip()


class SubscribeView(APIView):
    """
    POST /api/public/sites/{slug}/subscribe/ — ask to hear about new posts.

    Answers 202, always, with the same message: the row is `pending` and
    the subscription does not exist until a link in an email is followed.
    202 rather than 201 because nothing has been created as far as the
    reader is concerned — their request has been accepted, and the next
    move is theirs.

    404 when the blog has not switched subscriptions on. Not 403: a blog
    without subscriptions has no subscribe endpoint, and saying
    "forbidden" would describe a door that is not there.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    # Per IP. Loose enough for a household or an office behind one address,
    # tight enough that the form is not a free mail relay — every accepted
    # submission becomes an email to an address somebody else chose.
    throttle_scope = "subscribe"

    def post(self, request, slug: str):
        site = get_object_or_404(Site, slug=slug, subscriptions_enabled=True)

        serializer = SubscribeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # A filled honeypot means an automated submission. It is answered
        # exactly like a real one and nothing is written — telling a bot it
        # was caught only teaches it to stop filling the field in.
        if not data["website"]:
            subscriber = self._record(site, data["email"], data["source"])
            # Sends only for a `pending` row, and only if one has not gone
            # to this address in the last few minutes. Never raises: a
            # failure is logged and answered like a success, because an
            # endpoint that 5xx'd only when a message was due would be
            # announcing which addresses are already subscribed. See
            # send_subscription_confirmation.
            send_subscription_confirmation(subscriber)

        return Response({"detail": SUBSCRIBE_MESSAGE}, status=status.HTTP_202_ACCEPTED)

    @staticmethod
    def _record(site: Site, email: str, source: str) -> Subscriber:
        """
        Find or create the row this submission is about.

        Four cases, and the interesting ones are the last two:

        * **new address** — created `pending`;
        * **already pending** — left alone, so resubmitting the form
          cannot reset anybody's clock or mint a second confirm link;
        * **already confirmed** — left alone. The reader is told to check
          their inbox regardless, because the alternative is a form that
          says "you are already subscribed" and thereby answers, for any
          address a stranger cares to type, whether that person reads this
          blog;
        * **previously unsubscribed** — returned to `pending`, with the
          old confirmation cleared. Somebody typing their address into a
          form is a fresh request to join, so it is honoured, but it earns
          no more trust than a first-time one: they confirm again before
          anything is sent. `unsubscribed_at` is cleared with it, since it
          would otherwise sit there describing a subscription that is once
          more live.
        """
        subscriber, created = Subscriber.objects.get_or_create(
            site=site, email=email, defaults={"source": source}
        )

        if not created and subscriber.status == Subscriber.Status.UNSUBSCRIBED:
            subscriber.status = Subscriber.Status.PENDING
            subscriber.source = source
            subscriber.confirmed_at = None
            subscriber.unsubscribed_at = None
            subscriber.save(
                update_fields=["status", "source", "confirmed_at", "unsubscribed_at"]
            )

        # The caller sends the confirmation mail, for any row that comes
        # back `pending` — which is exactly the set of rows that need one,
        # in all four cases above. Note that "left alone" describes the
        # row's columns, not the mail: a reader who never received the
        # first message resubmits the form and gets another, subject to
        # the cooldown in blog/emails.py.
        return subscriber


class ConfirmSubscriptionView(APIView):
    """
    POST /api/public/subscriptions/confirm/ — spend a confirmation token.

    POST, not GET, although it is reached from a link in an email. Mail
    scanners and corporate security gateways fetch every URL in a message
    before a person sees it, and a GET here would let one of them confirm
    a subscription nobody agreed to — which is the one thing the
    confirmation step exists to prevent. The link in the mail therefore
    points at a page on the blog, and that page makes this request.

    No site slug in the path: the token names the row, and the row knows
    its site. Putting the slug here as well would only create the
    possibility of the two disagreeing.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "subscription_token"

    def post(self, request):
        try:
            subscriber = read_confirm_token(_token_from(request))
        except InvalidConfirmToken:
            return Response(
                {"detail": INVALID_TOKEN_MESSAGE}, status=status.HTTP_400_BAD_REQUEST
            )

        confirm_subscriber(subscriber)
        return Response(SubscriptionSerializer(subscriber).data)


class UnsubscribeView(APIView):
    """
    GET  /api/public/subscriptions/unsubscribe/?token= — what this link leaves.
    POST /api/public/subscriptions/unsubscribe/        — leave it.

    The split is what lets the link be safe to prefetch. GET only reads,
    so a mail scanner opening it changes nothing; POST is the decision,
    and the page in between is where a person makes it. The same POST is
    what a mail client will call directly for one-click unsubscribe in
    Phase 4, with the token in the query string — see _token_from.

    A missing or unknown token is 404 on both methods: there is no
    subscription at that address to describe or to end, and any more
    specific answer would let somebody grind the token space and learn
    when they had hit a real one.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    # Much looser than the subscribe limit, and the asymmetry is the
    # point: an unsubscribe that gets throttled is somebody being told
    # they may not leave a mailing list. The failure modes are not
    # comparable, so the limits are not either.
    throttle_scope = "subscription_unsubscribe"

    def get(self, request):
        return Response(SubscriptionSerializer(self._subscriber(request)).data)

    def post(self, request):
        subscriber = self._subscriber(request)
        unsubscribe_subscriber(subscriber)
        return Response(SubscriptionSerializer(subscriber).data)

    @staticmethod
    def _subscriber(request) -> Subscriber:
        token = _token_from(request)
        # An empty token must never match. It cannot — every row is saved
        # with a generated token and the column is unique — but filtering
        # on "" would be one refactor away from matching a blank column,
        # so it is refused before it reaches the database.
        if not token:
            raise Http404

        return get_object_or_404(
            Subscriber.objects.select_related("site"), unsubscribe_token=token
        )
