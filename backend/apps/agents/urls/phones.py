from django.urls import path, include
from rest_framework.routers import DefaultRouter
from ..views import PhoneViewSet

router = DefaultRouter()
router.register(r'', PhoneViewSet, basename='phones')

app_name = 'phones'

urlpatterns = [
    path('', include(router.urls)),
]
