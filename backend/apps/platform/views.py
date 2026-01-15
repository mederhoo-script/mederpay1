from rest_framework import status, generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer, AgentSerializer
from .models import Agent


class RegisterView(generics.CreateAPIView):
    """Agent registration endpoint"""
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """JWT login endpoint"""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        })


class LogoutView(APIView):
    """Logout endpoint"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh_token')
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'message': 'Logout successful'}, status=status.HTTP_200_OK)
        except Exception:
            return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)


class AgentProfileView(generics.RetrieveUpdateAPIView):
    """Get and update current agent profile"""
    serializer_class = AgentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return Agent.objects.get(user=self.request.user)


class AgentDashboardView(APIView):
    """Dashboard statistics"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        agent = Agent.objects.get(user=request.user)
        
        from apps.agents.models import Phone, Sale
        from apps.payments.models import PaymentRecord, InstallmentSchedule
        from django.db.models import Sum, Q, Count
        from django.utils import timezone
        
        # Get statistics
        total_phones = Phone.objects.filter(agent=agent).count()
        in_stock = Phone.objects.filter(agent=agent, status='in_stock').count()
        active_sales = Sale.objects.filter(agent=agent, status='active').count()
        
        total_outstanding = Sale.objects.filter(
            agent=agent, 
            status='active'
        ).aggregate(
            total=Sum('balance_remaining')
        )['total'] or 0
        
        overdue_count = InstallmentSchedule.objects.filter(
            sale__agent=agent,
            status='overdue'
        ).count()
        
        return Response({
            'total_phones': total_phones,
            'phones_in_stock': in_stock,
            'active_sales': active_sales,
            'total_outstanding_balance': float(total_outstanding),
            'overdue_payments_count': overdue_count,
            'credit_limit': float(agent.credit_limit),
            'credit_used': float(agent.credit_used),
            'credit_available': float(agent.credit_limit - agent.credit_used)
        })


class WeeklySettlementView(APIView):
    """
    Get weekly settlement status for an agent/device.
    Used by Android App A to check if settlement is due.
    """
    permission_classes = [permissions.AllowAny]  # Device auth via IMEI
    
    def get(self, request, imei):
        """Get settlement status for device"""
        from apps.agents.models import Phone
        from .models import AgentBilling, PlatformPhoneRegistry
        from django.utils import timezone
        from datetime import timedelta
        
        try:
            # Find phone and agent
            phone = Phone.objects.select_related('agent', 'platform_registry').get(imei=imei)
            agent = phone.agent
            
            # Get current week's billing record
            today = timezone.now().date()
            current_week_start = today - timedelta(days=today.weekday())
            current_week_end = current_week_start + timedelta(days=6)
            
            # Try to find current week's billing
            try:
                billing = AgentBilling.objects.filter(
                    agent=agent,
                    billing_period_start__lte=today,
                    billing_period_end__gte=today
                ).order_by('-created_at').first()
                
                if not billing:
                    return Response({
                        'has_settlement': False,
                        'is_due': False,
                        'is_overdue': False,
                        'message': 'No settlement due'
                    })
                
                is_overdue = (
                    billing.status in ['overdue', 'pending'] and 
                    billing.billing_period_end < today
                )
                is_due = (
                    billing.status in ['pending', 'overdue'] and
                    billing.amount_paid < billing.total_amount_due
                )
                amount_due = billing.total_amount_due - billing.amount_paid
                
                return Response({
                    'has_settlement': True,
                    'is_due': is_due,
                    'is_overdue': is_overdue,
                    'settlement_id': str(billing.id),
                    'amount_due': float(amount_due),
                    'total_amount': float(billing.total_amount_due),
                    'amount_paid': float(billing.amount_paid),
                    'due_date': billing.billing_period_end.isoformat(),
                    'invoice_number': billing.invoice_number,
                    'billing_period': {
                        'start': billing.billing_period_start.isoformat(),
                        'end': billing.billing_period_end.isoformat()
                    }
                })
                
            except AgentBilling.DoesNotExist:
                return Response({
                    'has_settlement': False,
                    'is_due': False,
                    'is_overdue': False,
                    'message': 'No billing record found'
                })
                
        except Phone.DoesNotExist:
            return Response(
                {'error': 'Phone not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ConfirmSettlementPaymentView(APIView):
    """
    Confirm settlement payment after Monnify transaction.
    Called by Android App A after successful Monnify payment.
    """
    permission_classes = [permissions.AllowAny]  # Device auth via IMEI
    
    def post(self, request, settlement_id):
        """Confirm payment for a settlement"""
        from .models import AgentBilling
        from apps.payments.models import PaymentRecord, PaymentMethod, PaymentStatus
        from apps.agents.models import Phone
        from django.utils import timezone
        
        payment_reference = request.data.get('payment_reference')
        amount = request.data.get('amount')
        imei = request.data.get('imei')
        
        if not all([payment_reference, amount, imei]):
            return Response(
                {'error': 'Missing required fields'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Get billing record
            billing = AgentBilling.objects.select_related('agent').get(id=settlement_id)
            phone = Phone.objects.get(imei=imei)
            
            # Verify phone belongs to agent
            if phone.agent != billing.agent:
                return Response(
                    {'error': 'Phone does not belong to agent'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Create payment record (for audit trail)
            payment = PaymentRecord.objects.create(
                agent=billing.agent,
                sale=None,  # This is agent billing, not sale payment
                installment=None,
                amount=amount,
                payment_method=PaymentMethod.MONNIFY,
                monnify_reference=payment_reference,
                status=PaymentStatus.CONFIRMED,
                balance_before=billing.total_amount_due - billing.amount_paid,
                balance_after=billing.total_amount_due - billing.amount_paid - float(amount),
                payment_date=timezone.now(),
                confirmed_at=timezone.now(),
                notes=f"Settlement payment for invoice {billing.invoice_number}"
            )
            
            # Update billing record
            billing.amount_paid += float(amount)
            if billing.amount_paid >= billing.total_amount_due:
                billing.status = 'paid'
                billing.paid_at = timezone.now()
            billing.save()
            
            # Log audit event
            from apps.audit.models import AuditLog
            AuditLog.objects.create(
                agent=billing.agent,
                event_type='settlement_payment_confirmed',
                description=f'Settlement payment confirmed: {payment_reference}',
                metadata={
                    'settlement_id': str(settlement_id),
                    'payment_reference': payment_reference,
                    'amount': str(amount),
                    'imei': imei
                }
            )
            
            return Response({
                'success': True,
                'message': 'Payment confirmed successfully',
                'payment_id': payment.id,
                'billing_status': billing.status,
                'remaining_balance': float(billing.total_amount_due - billing.amount_paid)
            })
            
        except AgentBilling.DoesNotExist:
            return Response(
                {'error': 'Settlement not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Phone.DoesNotExist:
            return Response(
                {'error': 'Phone not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

