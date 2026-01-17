from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PlatformAuditLogViewSet, AgentAuditLogViewSet
from .device_views import DeviceAuditLogViewSet

router = DefaultRouter()
router.register(r'platform', PlatformAuditLogViewSet, basename='platform-audit')
router.register(r'agent', AgentAuditLogViewSet, basename='agent-audit')
router.register(r'device-logs', DeviceAuditLogViewSet, basename='device-logs')

app_name = 'audit'

urlpatterns = [
    path('', include(router.urls)),
]
