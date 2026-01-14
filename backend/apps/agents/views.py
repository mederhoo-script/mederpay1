from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import AgentStaff, Customer, Phone, Sale
from .serializers import (
    AgentStaffSerializer, CustomerSerializer, 
    PhoneSerializer, SaleSerializer
)
from apps.platform.models import Agent


class AgentStaffViewSet(viewsets.ModelViewSet):
    """Sub-agents and staff management"""
    serializer_class = AgentStaffSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        agent = Agent.objects.get(user=self.request.user)
        return AgentStaff.objects.filter(agent=agent)
    
    def perform_create(self, serializer):
        agent = Agent.objects.get(user=self.request.user)
        serializer.save(agent=agent)


class CustomerViewSet(viewsets.ModelViewSet):
    """Customer management"""
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        agent = Agent.objects.get(user=self.request.user)
        return Customer.objects.filter(agent=agent)
    
    def perform_create(self, serializer):
        agent = Agent.objects.get(user=self.request.user)
        serializer.save(agent=agent)


class PhoneViewSet(viewsets.ModelViewSet):
    """Phone inventory management"""
    serializer_class = PhoneSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'brand', 'is_locked']
    search_fields = ['imei', 'brand', 'model', 'serial_number']
    
    def get_queryset(self):
        agent = Agent.objects.get(user=self.request.user)
        return Phone.objects.filter(agent=agent)
    
    def perform_create(self, serializer):
        agent = Agent.objects.get(user=self.request.user)
        serializer.save(agent=agent)
    
    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        """Get enforcement status for a phone"""
        phone = self.get_object()
        from apps.enforcement.models import DeviceCommand
        
        latest_command = DeviceCommand.objects.filter(phone=phone).first()
        
        return Response({
            'imei': phone.imei,
            'is_locked': phone.is_locked,
            'status': phone.status,
            'last_check': phone.last_enforcement_check,
            'latest_command': {
                'type': latest_command.command_type if latest_command else None,
                'status': latest_command.status if latest_command else None,
                'issued_at': latest_command.issued_at if latest_command else None,
            } if latest_command else None
        })


class SaleViewSet(viewsets.ModelViewSet):
    """Sales management"""
    serializer_class = SaleSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'customer', 'phone']
    
    def get_queryset(self):
        agent = Agent.objects.get(user=self.request.user)
        return Sale.objects.filter(agent=agent).select_related('customer', 'phone', 'staff')
    
    def perform_create(self, serializer):
        agent = Agent.objects.get(user=self.request.user)
        sale = serializer.save(agent=agent)
        
        # Update phone status
        sale.phone.status = 'sold'
        sale.phone.save()
        
        # Create installment schedule
        from apps.payments.models import InstallmentSchedule
        from datetime import timedelta
        from django.utils import timezone
        
        current_date = timezone.now().date()
        for i in range(1, sale.number_of_installments + 1):
            if sale.installment_frequency == 'weekly':
                due_date = current_date + timedelta(weeks=i)
            else:  # monthly
                due_date = current_date + timedelta(days=30 * i)
            
            InstallmentSchedule.objects.create(
                sale=sale,
                installment_number=i,
                amount=sale.installment_amount,
                due_date=due_date
            )
    
    @action(detail=True, methods=['get'])
    def payment_status(self, request, pk=None):
        """Get payment status for a sale"""
        sale = self.get_object()
        from apps.payments.models import InstallmentSchedule, PaymentRecord
        
        installments = InstallmentSchedule.objects.filter(sale=sale)
        payments = PaymentRecord.objects.filter(sale=sale, status='completed')
        
        return Response({
            'sale_id': sale.id,
            'total_payable': sale.total_payable,
            'balance_remaining': sale.balance_remaining,
            'down_payment': sale.down_payment,
            'installments': [
                {
                    'number': inst.installment_number,
                    'amount': inst.amount,
                    'due_date': inst.due_date,
                    'status': inst.status,
                    'paid_date': inst.paid_date
                }
                for inst in installments
            ],
            'payments': [
                {
                    'id': pay.id,
                    'amount': pay.amount,
                    'method': pay.payment_method,
                    'date': pay.payment_date,
                    'status': pay.status
                }
                for pay in payments
            ]
        })
