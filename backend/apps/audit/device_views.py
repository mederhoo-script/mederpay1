"""
Android Device Audit Log API
Receives and stores audit logs from enforcement apps
"""
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import AgentAuditLog
from .serializers import DeviceAuditLogSerializer
from apps.platform.models import Agent


class DeviceAuditLogViewSet(viewsets.ViewSet):
    """
    Endpoint for Android enforcement apps to submit audit logs
    POST /api/audit/device-logs/ - Submit batch of logs
    """
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['post'], url_path='batch')
    def batch_upload(self, request):
        """
        Accept batch upload of device audit logs from Android apps
        
        Payload:
        {
            "device_id": "abc123...",
            "app_version": "1.0.0",
            "logs": [
                {
                    "event": "settlement_enforcement_triggered",
                    "timestamp": "2024-01-17T10:30:00Z",
                    "data": {"settlement_id": "123", "amount": "5000"}
                },
                ...
            ]
        }
        """
        device_id = request.data.get('device_id')
        app_version = request.data.get('app_version')
        logs = request.data.get('logs', [])
        
        if not device_id or not logs:
            return Response(
                {'error': 'device_id and logs are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get agent from authenticated user
        try:
            agent = Agent.objects.get(user=request.user)
        except Agent.DoesNotExist:
            return Response(
                {'error': 'Agent profile not found'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Create audit log entries
        created_logs = []
        for log_data in logs:
            event = log_data.get('event')
            log_timestamp = log_data.get('timestamp')
            data = log_data.get('data', {})
            
            if not event:
                continue  # Skip invalid logs
            
            # Create agent audit log
            audit_log = AgentAuditLog.objects.create(
                agent=agent,
                action=f"device_{event}",
                entity_type='device_enforcement',
                entity_id=0,  # No specific entity ID for device events
                metadata={
                    'device_id': device_id,
                    'app_version': app_version,
                    'event': event,
                    'timestamp': log_timestamp,
                    'data': data
                },
                description=f"Device enforcement event: {event}",
                ip_address=self._get_client_ip(request)
            )
            created_logs.append(audit_log.id)
        
        return Response({
            'status': 'success',
            'logs_created': len(created_logs),
            'log_ids': created_logs
        }, status=status.HTTP_201_CREATED)
    
    def create(self, request):
        """
        Single log upload endpoint
        POST /api/audit/device-logs/
        """
        device_id = request.data.get('device_id')
        event = request.data.get('event')
        data = request.data.get('data', {})
        
        if not device_id or not event:
            return Response(
                {'error': 'device_id and event are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get agent from authenticated user
        try:
            agent = Agent.objects.get(user=request.user)
        except Agent.DoesNotExist:
            return Response(
                {'error': 'Agent profile not found'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Create audit log
        audit_log = AgentAuditLog.objects.create(
            agent=agent,
            action=f"device_{event}",
            entity_type='device_enforcement',
            entity_id=0,
            metadata={
                'device_id': device_id,
                'event': event,
                'data': data
            },
            description=f"Device enforcement event: {event}",
            ip_address=self._get_client_ip(request)
        )
        
        return Response({
            'status': 'success',
            'log_id': audit_log.id
        }, status=status.HTTP_201_CREATED)
    
    def _get_client_ip(self, request):
        """Extract client IP from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
