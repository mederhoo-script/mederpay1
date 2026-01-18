"""
Settlement Enforcement Decorators
Android 15+ Hardening: Backend enforcement for settlement payments

Prevents agents from bypassing mobile app restrictions via direct API calls.
"""
from functools import wraps
from django.core.exceptions import PermissionDenied
from django.utils import timezone
from django.http import JsonResponse

# Import will be available when monnify_models.py is accessible
try:
    from apps.payments.monnify_models import WeeklySettlement
except ImportError:
    # Fallback for testing/development
    WeeklySettlement = None


def require_settlement_paid(view_func):
    """
    Decorator to block inventory operations if agent has unpaid settlement.
    
    Android 15+ Hardening: Backend-level enforcement to prevent API bypass.
    
    Usage:
        @require_settlement_paid
        def create_phone(request):
            # Phone creation logic
            
    Returns:
        403 Forbidden with error message if settlement is overdue
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        # Only check for agent users (not platform admins)
        if hasattr(request.user, 'agent_profile'):
            agent = request.user.agent_profile
            
            # Check for overdue settlements
            if WeeklySettlement:
                overdue_settlement = WeeklySettlement.objects.filter(
                    agent=agent,
                    status__in=['PENDING', 'PARTIAL'],
                    due_date__lt=timezone.now()
                ).first()
                
                if overdue_settlement:
                    # Block the operation
                    raise PermissionDenied(
                        "Settlement payment required. Please clear pending settlement "
                        f"of ₦{overdue_settlement.total_amount - overdue_settlement.amount_paid:.2f} "
                        f"(Invoice: {overdue_settlement.invoice_number})."
                    )
        
        return view_func(request, *args, **kwargs)
    
    return wrapper


def check_settlement_status(view_func):
    """
    Decorator to add settlement status to response without blocking.
    
    Android 15+ Hardening: Informational check for dashboard/status endpoints.
    
    Adds settlement_status to response data:
        - has_overdue_settlement: Boolean
        - settlement_amount_due: Decimal
        - settlement_invoice: String
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        response = view_func(request, *args, **kwargs)
        
        # Only add settlement info for agent users
        if hasattr(request.user, 'agent_profile') and hasattr(response, 'data'):
            agent = request.user.agent_profile
            
            if WeeklySettlement:
                overdue_settlement = WeeklySettlement.objects.filter(
                    agent=agent,
                    status__in=['PENDING', 'PARTIAL'],
                    due_date__lt=timezone.now()
                ).first()
                
                if overdue_settlement:
                    if isinstance(response.data, dict):
                        response.data['settlement_status'] = {
                            'has_overdue_settlement': True,
                            'settlement_amount_due': float(
                                overdue_settlement.total_amount - overdue_settlement.amount_paid
                            ),
                            'settlement_invoice': overdue_settlement.invoice_number,
                            'settlement_due_date': overdue_settlement.due_date.isoformat(),
                        }
                else:
                    if isinstance(response.data, dict):
                        response.data['settlement_status'] = {
                            'has_overdue_settlement': False
                        }
        
        return response
    
    return wrapper


def settlement_enforcement_middleware(get_response):
    """
    Middleware to enforce settlement payment across all POST operations.
    
    Android 15+ Hardening: Global enforcement at middleware level.
    
    Usage in settings.py:
        MIDDLEWARE = [
            ...
            'apps.payments.decorators.settlement_enforcement_middleware',
        ]
    
    Protected paths (POST only):
        - /api/phones/
        - /api/sales/
        - /api/customers/
        - /api/staff/
    """
    PROTECTED_PATHS = [
        '/api/phones/',
        '/api/sales/',
        '/api/customers/',
        '/api/staff/',
    ]
    
    def middleware(request):
        # Only check POST requests to protected paths
        if request.method == 'POST' and any(
            request.path.startswith(path) for path in PROTECTED_PATHS
        ):
            # Only check authenticated agent users
            if request.user.is_authenticated and hasattr(request.user, 'agent_profile'):
                agent = request.user.agent_profile
                
                if WeeklySettlement:
                    overdue_settlement = WeeklySettlement.objects.filter(
                        agent=agent,
                        status__in=['PENDING', 'PARTIAL'],
                        due_date__lt=timezone.now()
                    ).exists()
                    
                    if overdue_settlement:
                        return JsonResponse({
                            'error': 'Settlement payment required',
                            'detail': 'Please clear pending settlement before continuing operations.',
                            'error_code': 'SETTLEMENT_OVERDUE',
                            'help': 'Contact support or make payment via mobile app.'
                        }, status=402)  # 402 Payment Required
        
        return get_response(request)
    
    return middleware
