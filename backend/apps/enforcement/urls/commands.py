from django.urls import path, include
from rest_framework.routers import DefaultRouter
from ..views import DeviceCommandViewSet

router = DefaultRouter()
router.register(r'', DeviceCommandViewSet, basename='commands')

app_name = 'commands'

urlpatterns = [
    path('', include(router.urls)),
]
