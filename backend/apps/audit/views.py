from rest_framework import viewsets, permissions
from .models import PlatformAuditLog, AgentAuditLog
from .serializers import PlatformAuditLogSerializer, AgentAuditLogSerializer
from apps.platform.models import Agent


class PlatformAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Platform-level audit logs (read-only)"""
    serializer_class = PlatformAuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['action', 'resource_type', 'user']
    
    def get_queryset(self):
        # Only platform admins can view platform audit logs
        if self.request.user.role == 'platform_admin':
            return PlatformAuditLog.objects.all()
        return PlatformAuditLog.objects.none()


class AgentAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Agent-level audit logs (read-only)"""
    serializer_class = AgentAuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['action', 'resource_type', 'user']
    
    def get_queryset(self):
        agent = Agent.objects.get(user=self.request.user)
        return AgentAuditLog.objects.filter(agent=agent)
