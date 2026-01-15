from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from .models import DeviceCommand
from .serializers import DeviceCommandSerializer
from apps.platform.models import Agent
from apps.agents.models import Phone


class DeviceCommandViewSet(viewsets.ModelViewSet):
    """Device command management"""
    serializer_class = DeviceCommandSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'command', 'phone']
    
    def get_queryset(self):
        agent = Agent.objects.get(user=self.request.user)
        return DeviceCommand.objects.filter(agent=agent).select_related('phone')
    
    def perform_create(self, serializer):
        agent = Agent.objects.get(user=self.request.user)
        serializer.save(agent=agent)
    
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
        command.save()
        
        return Response({'status': 'acknowledged'})
    
    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        """Mark command as executed (Android API)"""
        command = self.get_object()
        command.status = 'executed'
        command.executed_at = timezone.now()
        command.save()
        
        return Response({'status': 'executed'})


class EnforcementStatusView(APIView):
    """Get enforcement status for a device"""
    permission_classes = [permissions.AllowAny]  # Android API
    
    def get(self, request, imei):
        try:
            phone = Phone.objects.get(imei=imei)
            from apps.agents.models import Sale
            sale = Sale.objects.filter(phone=phone, status='active').first()
            
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
