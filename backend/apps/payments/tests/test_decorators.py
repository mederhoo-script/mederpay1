"""
Tests for settlement enforcement decorator
"""
import pytest
from django.core.exceptions import PermissionDenied
from datetime import timedelta
from django.utils import timezone
from django.test import RequestFactory

from apps.payments.decorators import require_settlement_paid
from apps.payments.monnify_models import WeeklySettlement


@pytest.mark.django_db
class TestSettlementEnforcementDecorator:
    """Test @require_settlement_paid decorator"""
    
    def test_allows_operation_when_no_settlement(self, agent, user):
        """Should allow operation when no settlement exists"""
        request = RequestFactory().post('/api/phones/')
        request.user = user
        request.user.agent_profile = agent
        
        @require_settlement_paid
        def test_view(request):
            return "success"
        
        result = test_view(request)
        assert result == "success"
    
    def test_allows_operation_when_settlement_not_due(self, agent, user):
        """Should allow operation when settlement is not yet due"""
        # Create settlement due in the future
        future_date = timezone.now() + timedelta(days=7)
        WeeklySettlement.objects.create(
            agent=agent,
            week_ending=future_date.date(),
            total_amount=5000.00,
            amount_paid=0.00,
            status='PENDING',
            due_date=future_date,
            invoice_number='INV-TEST-001'
        )
        
        request = RequestFactory().post('/api/phones/')
        request.user = user
        request.user.agent_profile = agent
        
        @require_settlement_paid
        def test_view(request):
            return "success"
        
        result = test_view(request)
        assert result == "success"
    
    def test_allows_operation_when_settlement_paid(self, agent, user):
        """Should allow operation when settlement is fully paid"""
        yesterday = timezone.now() - timedelta(days=1)
        WeeklySettlement.objects.create(
            agent=agent,
            week_ending=yesterday.date(),
            total_amount=5000.00,
            amount_paid=5000.00,
            status='PAID',
            due_date=yesterday,
            paid_date=timezone.now(),
            invoice_number='INV-TEST-002'
        )
        
        request = RequestFactory().post('/api/phones/')
        request.user = user
        request.user.agent_profile = agent
        
        @require_settlement_paid
        def test_view(request):
            return "success"
        
        result = test_view(request)
        assert result == "success"
    
    def test_blocks_operation_when_settlement_overdue(self, agent, user):
        """Should block operation when settlement is overdue"""
        yesterday = timezone.now() - timedelta(days=1)
        WeeklySettlement.objects.create(
            agent=agent,
            week_ending=yesterday.date(),
            total_amount=5000.00,
            amount_paid=0.00,
            status='PENDING',
            due_date=yesterday,
            invoice_number='INV-TEST-003'
        )
        
        request = RequestFactory().post('/api/phones/')
        request.user = user
        request.user.agent_profile = agent
        
        @require_settlement_paid
        def test_view(request):
            return "success"
        
        with pytest.raises(PermissionDenied, match="Settlement payment required"):
            test_view(request)
    
    def test_blocks_operation_when_partial_payment_overdue(self, agent, user):
        """Should block operation when settlement is partially paid but still overdue"""
        yesterday = timezone.now() - timedelta(days=1)
        WeeklySettlement.objects.create(
            agent=agent,
            week_ending=yesterday.date(),
            total_amount=5000.00,
            amount_paid=2000.00,  # Partial payment
            status='PARTIAL',
            due_date=yesterday,
            invoice_number='INV-TEST-004'
        )
        
        request = RequestFactory().post('/api/phones/')
        request.user = user
        request.user.agent_profile = agent
        
        @require_settlement_paid
        def test_view(request):
            return "success"
        
        with pytest.raises(PermissionDenied):
            test_view(request)
    
    def test_ignores_non_agent_users(self, user):
        """Should allow operation for non-agent users (platform admins)"""
        request = RequestFactory().post('/api/phones/')
        request.user = user
        # No agent_profile attribute
        
        @require_settlement_paid
        def test_view(request):
            return "success"
        
        result = test_view(request)
        assert result == "success"
