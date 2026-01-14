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
