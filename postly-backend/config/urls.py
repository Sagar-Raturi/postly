from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("blog.urls")),
    # DRF's login/logout for the browsable API while there is no real auth.
    path("api-auth/", include("rest_framework.urls")),
]

# Post images are served by Django in development only; a real deployment
# puts them behind S3 or a CDN.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
