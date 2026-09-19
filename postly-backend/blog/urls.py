from django.urls import path
from rest_framework.routers import DefaultRouter

from .onboarding import OnboardingSiteView, SlugAvailabilityView
from .views import PostViewSet, SiteViewSet, SubscriberViewSet

router = DefaultRouter()
router.register("sites", SiteViewSet, basename="site")
router.register("posts", PostViewSet, basename="post")
router.register("subscribers", SubscriberViewSet, basename="subscriber")

urlpatterns = [
    path("onboarding/site/", OnboardingSiteView.as_view(), name="onboarding-site"),
    path(
        "onboarding/slug-available/",
        SlugAvailabilityView.as_view(),
        name="onboarding-slug-available",
    ),
    *router.urls,
]
