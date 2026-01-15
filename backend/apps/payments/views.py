from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from .models import PaymentRecord, InstallmentSchedule
from .serializers import PaymentRecordSerializer, InstallmentScheduleSerializer
from apps.platform.models import Agent
from apps.agents.models import Sale


class PaymentRecordViewSet(viewsets.ModelViewSet):
    """Payment records management"""
    serializer_class = PaymentRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'payment_method', 'sale']
    
    def get_queryset(self):
        agent = Agent.objects.get(user=self.request.user)
        return PaymentRecord.objects.filter(agent=agent).select_related('sale')
    
    def perform_create(self, serializer):
        agent = Agent.objects.get(user=self.request.user)
        sale = serializer.validated_data['sale']
        amount = serializer.validated_data['amount']
        
        # Record balance before and after
        balance_before = sale.balance_remaining
        balance_after = max(0, balance_before - amount)
        
        payment = serializer.save(
            agent=agent,
            balance_before=balance_before,
            balance_after=balance_after,
            status='confirmed'
        )
        
        # Update sale balance
        sale.balance_remaining = balance_after
        if balance_after == 0:
            sale.status = 'completed'
            sale.completion_date = timezone.now()
            
            # Issue unlock command
            from apps.enforcement.models import DeviceCommand
            import hashlib
            from django.utils import timezone as tz
            
            # Generate secure token hash
            token = f"{sale.id}-{tz.now().timestamp()}"
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            
            DeviceCommand.objects.create(
                phone=sale.phone,
                agent=agent,
                sale=sale,
                command='unlock',
                reason='Payment completed',
                auth_token_hash=token_hash,
                expires_at=timezone.now() + timezone.timedelta(days=1)
            )
        
        sale.save()
        
        # Update installment statuses
        InstallmentSchedule.objects.filter(
            sale=sale,
            status='pending'
        ).update(status='paid', paid_date=timezone.now().date())
    
    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get overdue payments"""
        agent = Agent.objects.get(user=request.user)
        today = timezone.now().date()
        
        overdue_installments = InstallmentSchedule.objects.filter(
            sale__agent=agent,
            status='pending',
            due_date__lt=today
        ).select_related('sale', 'sale__customer', 'sale__phone')
        
        # Update status to overdue
        overdue_installments.update(status='overdue')
        
        return Response([
            {
                'installment_id': inst.id,
                'sale_id': inst.sale.id,
                'customer_name': inst.sale.customer.full_name,
                'phone_model': f"{inst.sale.phone.brand} {inst.sale.phone.model}",
                'amount': inst.amount,
                'due_date': inst.due_date,
                'days_overdue': (today - inst.due_date).days
            }
            for inst in overdue_installments
        ])


class MonnifyWebhookView(APIView):
    """Monnify payment webhook handler"""
    permission_classes = [permissions.AllowAny]  # Monnify will call this
    
    def post(self, request):
        # Simplified webhook handler - in production, verify signature
        data = request.data
        
        transaction_reference = data.get('transactionReference')
        payment_reference = data.get('paymentReference')
        amount_paid = data.get('amountPaid')
        payment_status = data.get('paymentStatus')
        
        if payment_status == 'PAID':
            # Find and update payment record
            try:
                payment = PaymentRecord.objects.get(
                    monnify_transaction_reference=transaction_reference
                )
                payment.status = 'completed'
                payment.confirmed_at = timezone.now()
                payment.save()
                
                # Update sale balance
                sale = payment.sale
                sale.balance_remaining = payment.balance_after
                if sale.balance_remaining == 0:
                    sale.status = 'completed'
                    sale.completion_date = timezone.now()
                sale.save()
                
                return Response({'status': 'success'})
            except PaymentRecord.DoesNotExist:
                return Response({'error': 'Payment not found'}, status=404)
        
        return Response({'status': 'received'})
