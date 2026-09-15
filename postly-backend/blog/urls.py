from rest_framework.routers import DefaultRouter

from .views import PostViewSet, SiteViewSet

router = DefaultRouter()
router.register("sites", SiteViewSet, basename="site")
router.register("posts", PostViewSet, basename="post")

urlpatterns = router.urls
