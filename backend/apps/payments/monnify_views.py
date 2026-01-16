"""
Monnify Integration Views
API endpoints for mobile app and webhook handling
"""
import json
import logging
from decimal import Decimal
from datetime import datetime, timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.db import transaction

from apps.platform.models import Agent
from apps.agents.models import Phone
from .monnify_models import (
    MonnifyReservedAccount,
    MonnifyWebhookLog,
    WeeklySettlement,
    SettlementPayment
)
from .monnify_service import monnify_service, MonnifyAPIError

logger = logging.getLogger(__name__)


@require_http_methods(["GET"])
def get_reserved_account(request, imei):
    """
    Get reserved account details for a device
    
    Endpoint: GET /api/monnify/reserved-account/{imei}/
    
    Returns account number, bank name, etc. for display in mobile app
    """
    try:
        # Find phone by IMEI
        try:
            phone = Phone.objects.select_related('agent').get(imei=imei)
        except Phone.DoesNotExist:
            return JsonResponse({
                'success': False,
                'message': 'Device not found'
            }, status=404)
        
        agent = phone.agent
        
        # Check if agent already has a reserved account
        try:
            reserved_account = MonnifyReservedAccount.objects.get(agent=agent)
            
            return JsonResponse({
                'success': True,
                'account_number': reserved_account.account_number,
                'account_name': reserved_account.account_name,
                'bank_name': reserved_account.bank_name,
                'bank_code': reserved_account.bank_code
            })
            
        except MonnifyReservedAccount.DoesNotExist:
            # Create reserved account via Monnify API
            try:
                account_reference = f"agent-{agent.id}"
                
                result = monnify_service.create_reserved_account(
                    account_reference=account_reference,
                    account_name=agent.business_name[:40],
                    customer_email=agent.user.email,
                    customer_name=agent.business_name
                )
                
                # Parse created_on timestamp
                monnify_created_at = None
                if result.get('created_on'):
                    try:
                        monnify_created_at = datetime.strptime(
                            result['created_on'],
                            '%Y-%m-%d %H:%M:%S.%f'
                        )
                    except ValueError:
                        pass
                
                # Save to database
                reserved_account = MonnifyReservedAccount.objects.create(
                    agent=agent,
                    account_reference=result['account_reference'],
                    account_number=result['account_number'],
                    account_name=result['account_name'],
                    bank_name=result['bank_name'],
                    bank_code=result['bank_code'],
                    reservation_reference=result['reservation_reference'],
                    status=result['status'],
                    monnify_created_at=monnify_created_at
                )
                
                logger.info(f"Created reserved account for agent {agent.id}: {reserved_account.account_number}")
                
                return JsonResponse({
                    'success': True,
                    'account_number': reserved_account.account_number,
                    'account_name': reserved_account.account_name,
                    'bank_name': reserved_account.bank_name,
                    'bank_code': reserved_account.bank_code
                })
                
            except MonnifyAPIError as e:
                logger.error(f"Failed to create reserved account for agent {agent.id}: {str(e)}")
                return JsonResponse({
                    'success': False,
                    'message': f'Failed to create payment account: {str(e)}'
                }, status=500)
    
    except Exception as e:
        logger.error(f"Error in get_reserved_account: {str(e)}", exc_info=True)
        return JsonResponse({
            'success': False,
            'message': 'Internal server error'
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def monnify_webhook(request):
    """
    Handle payment notifications from Monnify
    
    Endpoint: POST /webhooks/monnify/
    
    Called by Monnify when payments are received
    """
    try:
        # Verify webhook signature
        signature = request.headers.get('Monnify-Signature', '')
        
        if not monnify_service.verify_webhook_signature(request.body, signature):
            logger.warning("Invalid Monnify webhook signature")
            return JsonResponse({'error': 'Invalid signature'}, status=401)
        
        # Parse payload
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            logger.error("Invalid JSON in Monnify webhook")
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        
        # Log webhook
        webhook_log = MonnifyWebhookLog.objects.create(
            event_type=data.get('eventType', 'UNKNOWN'),
            transaction_reference=data.get('transactionReference', ''),
            account_number=data.get('accountNumber'),
            amount_paid=data.get('amountPaid'),
            payment_reference=data.get('paymentReference'),
            customer_name=data.get('customerName'),
            paid_on=data.get('paidOn'),
            raw_payload=data,
            signature=signature
        )
        
        # Process SUCCESSFUL_TRANSACTION events
        if data.get('eventType') == 'SUCCESSFUL_TRANSACTION':
            try:
                process_successful_payment(data, webhook_log)
                
                webhook_log.processed = True
                webhook_log.processed_at = timezone.now()
                webhook_log.save()
                
                return JsonResponse({'status': 'success'})
                
            except Exception as e:
                logger.error(f"Error processing webhook: {str(e)}", exc_info=True)
                webhook_log.processing_error = str(e)
                webhook_log.save()
                
                # Return 200 to prevent Monnify retries
                return JsonResponse({'status': 'error', 'message': str(e)})
        
        # Acknowledge other event types
        return JsonResponse({'status': 'ignored'})
    
    except Exception as e:
        logger.error(f"Error in monnify_webhook: {str(e)}", exc_info=True)
        return JsonResponse({'error': 'Internal server error'}, status=500)


@transaction.atomic
def process_successful_payment(data: dict, webhook_log: MonnifyWebhookLog):
    """
    Process a successful payment from Monnify webhook
    
    Args:
        data: Webhook payload
        webhook_log: WebhookLog instance
    """
    account_number = data.get('accountNumber')
    amount_paid = Decimal(str(data.get('amountPaid', 0)))
    transaction_reference = data.get('transactionReference')
    paid_on_str = data.get('paidOn')
    
    # Parse payment date
    try:
        paid_on = datetime.fromisoformat(paid_on_str.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        paid_on = timezone.now()
    
    # Find agent by account number
    try:
        reserved_account = MonnifyReservedAccount.objects.select_related('agent').get(
            account_number=account_number
        )
        agent = reserved_account.agent
    except MonnifyReservedAccount.DoesNotExist:
        raise ValueError(f"No agent found for account number: {account_number}")
    
    # Find pending settlement for this agent
    settlement = WeeklySettlement.objects.filter(
        agent=agent,
        status__in=['PENDING', 'PARTIAL']
    ).order_by('-week_ending').first()
    
    if not settlement:
        logger.warning(f"No pending settlement for agent {agent.id}")
        # Still log the payment but don't link to settlement
        return
    
    # Create settlement payment record
    settlement_payment = SettlementPayment.objects.create(
        settlement=settlement,
        amount=amount_paid,
        payment_reference=transaction_reference,
        payment_method='BANK_TRANSFER',
        status='CONFIRMED',
        payment_date=paid_on,
        confirmed_at=timezone.now()
    )
    
    # Update settlement
    settlement.amount_paid += amount_paid
    
    if settlement.amount_paid >= settlement.total_amount:
        settlement.status = 'PAID'
        settlement.paid_date = timezone.now()
        settlement.payment_reference = transaction_reference
    elif settlement.amount_paid > 0:
        settlement.status = 'PARTIAL'
    
    settlement.save()
    
    # Link webhook to payment
    webhook_log.payment_record_id = settlement_payment.id
    webhook_log.save()
    
    logger.info(
        f"Processed payment for agent {agent.id}: "
        f"₦{amount_paid} towards settlement {settlement.id}"
    )


@require_http_methods(["GET"])
def get_weekly_settlement(request, imei):
    """
    Get weekly settlement status for a device
    
    Endpoint: GET /api/settlements/weekly/{imei}/
    
    Used by mobile app to check if payment is required and poll for confirmation
    """
    try:
        # Find phone by IMEI
        try:
            phone = Phone.objects.select_related('agent').get(imei=imei)
        except Phone.DoesNotExist:
            return JsonResponse({
                'success': False,
                'message': 'Device not found'
            }, status=404)
        
        agent = phone.agent
        
        # Get current week's settlement
        from datetime import date, timedelta
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        
        settlement = WeeklySettlement.objects.filter(
            agent=agent,
            week_ending=week_end
        ).first()
        
        if not settlement:
            return JsonResponse({
                'has_settlement': False,
                'is_due': False,
                'is_paid': False,
                'is_overdue': False
            })
        
        is_overdue = settlement.is_overdue
        is_paid = settlement.status == 'PAID'
        is_due = settlement.status in ['PENDING', 'PARTIAL'] and not is_overdue
        
        response_data = {
            'has_settlement': True,
            'is_due': is_due,
            'is_paid': is_paid,
            'is_overdue': is_overdue,
            'settlement_id': str(settlement.id),
            'amount_due': float(settlement.total_amount - settlement.amount_paid),
            'total_amount': float(settlement.total_amount),
            'amount_paid': float(settlement.amount_paid),
            'due_date': settlement.due_date.isoformat(),
            'invoice_number': settlement.invoice_number,
            'message': None
        }
        
        # Add payment reference if paid
        if is_paid and settlement.payment_reference:
            response_data['payment_reference'] = settlement.payment_reference
        
        # Add helpful messages
        if is_overdue:
            response_data['message'] = 'Payment is overdue. Please make payment immediately.'
        elif is_due:
            response_data['message'] = f'Payment of ₦{response_data["amount_due"]:.2f} is due.'
        elif is_paid:
            response_data['message'] = 'Payment received. Thank you!'
        
        return JsonResponse(response_data)
    
    except Exception as e:
        logger.error(f"Error in get_weekly_settlement: {str(e)}", exc_info=True)
        return JsonResponse({
            'success': False,
            'message': 'Internal server error'
        }, status=500)
