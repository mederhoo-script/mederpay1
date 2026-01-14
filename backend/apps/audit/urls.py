from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PlatformAuditLogViewSet, AgentAuditLogViewSet

router = DefaultRouter()
router.register(r'platform', PlatformAuditLogViewSet, basename='platform-audit')
router.register(r'agent', AgentAuditLogViewSet, basename='agent-audit')

app_name = 'audit'

urlpatterns = [
    path('', include(router.urls)),
]
