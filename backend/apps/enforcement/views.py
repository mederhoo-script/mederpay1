from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from .models import DeviceCommand, DeviceHealthCheck
from .serializers import DeviceCommandSerializer, DeviceHealthCheckSerializer
from apps.platform.models import Agent
from apps.agents.models import Phone


class DeviceCommandViewSet(viewsets.ModelViewSet):
    """Device command management"""
    serializer_class = DeviceCommandSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'command_type', 'phone']
    
    def get_queryset(self):
        agent = Agent.objects.get(user=self.request.user)
        return DeviceCommand.objects.filter(agent=agent).select_related('phone')
    
    def perform_create(self, serializer):
        agent = Agent.objects.get(user=self.request.user)
        serializer.save(agent=agent, issued_by=self.request.user)
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending commands for a device (Android API)"""
        imei = request.query_params.get('imei')
        if not imei:
            return Response({'error': 'IMEI required'}, status=400)
        
        try:
            phone = Phone.objects.get(imei=imei)
            commands = DeviceCommand.objects.filter(
                phone=phone,
                status__in=['pending', 'sent']
            )
            
            # Update status to sent
            commands.update(status='sent')
            
            return Response(DeviceCommandSerializer(commands, many=True).data)
        except Phone.DoesNotExist:
            return Response({'error': 'Phone not found'}, status=404)
    
    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Acknowledge command received (Android API)"""
        command = self.get_object()
        command.status = 'acknowledged'
        command.acknowledged_at = timezone.now()
        command.save()
        
        return Response({'status': 'acknowledged'})
    
    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        """Mark command as executed (Android API)"""
        command = self.get_object()
        command.status = 'executed'
        command.executed_at = timezone.now()
        command.device_response = request.data.get('response', '')
        command.save()
        
        # Update phone lock status
        if command.command_type == 'lock':
            command.phone.is_locked = True
        elif command.command_type == 'unlock':
            command.phone.is_locked = False
        command.phone.save()
        
        return Response({'status': 'executed'})


class EnforcementStatusView(APIView):
    """Get enforcement status for a device"""
    permission_classes = [permissions.AllowAny]  # Android API
    
    def get(self, request, imei):
        try:
            phone = Phone.objects.get(imei=imei)
            sale = phone.sales.filter(status='active').first()
            
            if not sale:
                return Response({
                    'should_lock': False,
                    'reason': 'No active sale',
                    'balance': 0
                })
            
            # Check if payment is overdue
            from apps.payments.models import InstallmentSchedule
            today = timezone.now().date()
            overdue_installments = InstallmentSchedule.objects.filter(
                sale=sale,
                status__in=['pending', 'overdue'],
                due_date__lt=today
            )
            
            should_lock = overdue_installments.exists()
            
            return Response({
                'should_lock': should_lock,
                'reason': 'Payment overdue' if should_lock else 'Up to date',
                'balance': float(sale.balance_remaining),
                'overdue_count': overdue_installments.count()
            })
        except Phone.DoesNotExist:
            return Response({'error': 'Phone not found'}, status=404)


class HealthCheckView(APIView):
    """Device health check endpoint"""
    permission_classes = [permissions.AllowAny]  # Android API
    
    def post(self, request):
        imei = request.data.get('imei')
        if not imei:
            return Response({'error': 'IMEI required'}, status=400)
        
        try:
            phone = Phone.objects.get(imei=imei)
            
            health_check = DeviceHealthCheck.objects.create(
                phone=phone,
                is_device_admin_enabled=request.data.get('is_device_admin_enabled', False),
                is_companion_app_installed=request.data.get('is_companion_app_installed', False),
                companion_app_version=request.data.get('companion_app_version'),
                android_version=request.data.get('android_version', 'unknown'),
                app_version=request.data.get('app_version', 'unknown'),
                battery_level=request.data.get('battery_level'),
                is_locked=request.data.get('is_locked', False),
                lock_reason=request.data.get('lock_reason')
            )
            
            phone.last_enforcement_check = timezone.now()
            phone.save()
            
            return Response(DeviceHealthCheckSerializer(health_check).data)
        except Phone.DoesNotExist:
            return Response({'error': 'Phone not found'}, status=404)
