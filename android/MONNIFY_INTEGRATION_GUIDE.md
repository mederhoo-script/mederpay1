# Monnify Payment Integration Guide

## Overview

The MederPay Enforcer A app integrates with Monnify payment gateway for weekly settlement enforcement. **All Monnify API operations are handled securely by the backend** - the mobile app never directly communicates with Monnify or handles API credentials.

## Security Architecture

### ✅ Correct Implementation (Current)

```
Mobile App → Backend API → Monnify API
```

**Mobile App Responsibilities:**
- Request reserved account details from backend
- Display account information to user
- Poll backend for payment confirmation
- Handle UI and user interaction

**Backend Responsibilities:**
- Store Monnify API credentials securely (never exposed to app)
- Authenticate with Monnify API
- Create and manage reserved accounts
- Handle Monnify webhooks for payment notifications
- Validate and confirm payments

### ❌ Security Anti-Pattern (What NOT to Do)

```
Mobile App → Monnify API (INSECURE - credentials exposed)
```

**Why this is wrong:**
- API credentials would be embedded in the app (easily decompiled)
- Users could extract credentials and abuse the API
- Credentials could be stolen and used maliciously
- No centralized control over payment flows
- Violates PCI compliance requirements

## Monnify Configuration

### Test Credentials (Backend Only)
```
API Key: MK_TEST_7M5NZ5HX39
Secret Key: 0VCQQYWR4GLTLYDX1WYZDJABANLX6RVB
Contract Code: 2570907178
Base URL: https://sandbox.monnify.com
```

**⚠️ CRITICAL:** These credentials must ONLY be stored on the backend server in environment variables, never in the mobile app code or configuration files.

## Mobile App Implementation

### MonnifyPaymentManager.kt

The app implements a secure payment coordinator that communicates only with the backend:

```kotlin
/**
 * MonnifyPaymentManager - Secure payment coordinator
 * 
 * This manager does NOT communicate with Monnify directly.
 * All Monnify operations are handled by the backend for security.
 */
object MonnifyPaymentManager {
    
    /**
     * Get reserved account details from backend
     */
    suspend fun getReservedAccountInfo(context: Context): ReservedAccountInfo? {
        val imei = getDeviceIMEI(context)
        
        // Backend handles Monnify authentication and account retrieval
        val response = ApiClient.service.getReservedAccount(imei)
        
        if (response.success) {
            return ReservedAccountInfo(
                accountNumber = response.account_number,
                accountName = response.account_name,
                bankName = response.bank_name,
                bankCode = response.bank_code
            )
        }
        return null
    }
    
    /**
     * Initiate payment flow
     * 1. Get account details
     * 2. Display to user
     * 3. Poll for confirmation
     */
    fun initiatePayment(
        activity: Activity,
        amount: Double,
        settlementId: String,
        onSuccess: (String) -> Unit,
        onFailure: (String) -> Unit,
        onCancelled: () -> Unit
    ) {
        // Get account info from backend
        val accountInfo = getReservedAccountInfo(activity)
        
        // Display account details to user
        showPaymentDialog(activity, accountInfo, amount)
        
        // Start polling backend for payment confirmation
        startPaymentPolling(settlementId, onSuccess, onFailure)
    }
}
```

### Payment Flow

1. **Request Account Details**
   ```kotlin
   GET /api/monnify/reserved-account/{imei}
   ```

2. **Display to User**
   - Show bank name, account number, amount
   - Provide "Copy Account" button
   - User makes transfer via their banking app

3. **Poll for Confirmation**
   ```kotlin
   GET /api/settlements/weekly/{imei}
   // Poll every 5 seconds for up to 5 minutes
   // Then continue in background for up to 30 minutes
   ```

4. **Handle Success**
   - Backend confirms via webhook
   - App receives payment confirmation
   - Dismiss overlay, show success

## Backend Implementation

### Required Components

#### 1. Environment Variables
```bash
MONNIFY_API_KEY=MK_TEST_7M5NZ5HX39
MONNIFY_SECRET_KEY=0VCQQYWR4GLTLYDX1WYZDJABANLX6RVB
MONNIFY_CONTRACT_CODE=2570907178
MONNIFY_BASE_URL=https://sandbox.monnify.com
```

#### 2. Monnify Authentication

```python
import base64
import requests
from django.conf import settings

def authenticate_monnify():
    """Authenticate with Monnify API"""
    credentials = f"{settings.MONNIFY_API_KEY}:{settings.MONNIFY_SECRET_KEY}"
    base64_creds = base64.b64encode(credentials.encode()).decode()
    
    response = requests.post(
        f"{settings.MONNIFY_BASE_URL}/api/v1/auth/login",
        headers={"Authorization": f"Basic {base64_creds}"}
    )
    
    data = response.json()
    return data['responseBody']['accessToken']
```

#### 3. Create Reserved Account

```python
def create_reserved_account(agent):
    """Create Monnify reserved account for agent during onboarding"""
    access_token = authenticate_monnify()
    
    response = requests.post(
        f"{settings.MONNIFY_BASE_URL}/api/v2/bank-transfer/reserved-accounts",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        },
        json={
            "accountReference": f"agent-{agent.id}",
            "accountName": agent.business_name[:40],  # Max 40 chars
            "currencyCode": "NGN",
            "contractCode": settings.MONNIFY_CONTRACT_CODE,
            "customerEmail": agent.email,
            "customerName": agent.business_name,
            "getAllAvailableBanks": True
        }
    )
    
    data = response.json()['responseBody']
    account = data['accounts'][0]
    
    # Save to database
    agent.monnify_account_number = account['accountNumber']
    agent.monnify_account_name = account['accountName']
    agent.monnify_bank_name = account['bankName']
    agent.monnify_bank_code = account['bankCode']
    agent.monnify_reservation_ref = data['reservationReference']
    agent.save()
    
    return account
```

#### 4. Webhook Handler

```python
@csrf_exempt
def monnify_webhook(request):
    """Handle payment notifications from Monnify"""
    # Verify signature
    signature = request.headers.get('Monnify-Signature')
    if not verify_monnify_signature(signature, request.body):
        return JsonResponse({'error': 'Invalid signature'}, status=401)
    
    data = json.loads(request.body)
    
    if data['eventType'] == 'SUCCESSFUL_TRANSACTION':
        account_number = data['accountNumber']
        amount_paid = Decimal(data['amountPaid'])
        payment_ref = data['transactionReference']
        paid_on = datetime.fromisoformat(data['paidOn'])
        
        try:
            agent = Agent.objects.get(monnify_account_number=account_number)
            
            # Find pending settlement
            settlement = WeeklySettlement.objects.filter(
                agent=agent,
                status='PENDING'
            ).order_by('-week_ending').first()
            
            if settlement:
                # Create payment record
                payment = SettlementPayment.objects.create(
                    settlement=settlement,
                    amount=amount_paid,
                    payment_reference=payment_ref,
                    payment_method='BANK_TRANSFER',
                    payment_date=paid_on,
                    status='CONFIRMED'
                )
                
                # Update settlement
                settlement.amount_paid += amount_paid
                if settlement.amount_paid >= settlement.total_amount:
                    settlement.status = 'PAID'
                    settlement.paid_date = paid_on
                settlement.save()
                
                logger.info(f"Payment confirmed: {payment_ref} for agent {agent.id}")
                
                return JsonResponse({'status': 'success'})
        
        except Agent.DoesNotExist:
            logger.error(f"Agent not found for account: {account_number}")
    
    return JsonResponse({'status': 'ignored'})
```

#### 5. API Endpoints

```python
# urls.py
urlpatterns = [
    path('api/monnify/reserved-account/<str:imei>/', get_reserved_account),
    path('webhooks/monnify/', monnify_webhook),
]

# views.py
@api_view(['GET'])
def get_reserved_account(request, imei):
    """Get reserved account details for mobile app"""
    try:
        phone = Phone.objects.get(imei=imei)
        agent = phone.agent
        
        # Create account if doesn't exist
        if not agent.monnify_account_number:
            create_reserved_account(agent)
        
        return Response({
            'success': True,
            'account_number': agent.monnify_account_number,
            'account_name': agent.monnify_account_name,
            'bank_name': agent.monnify_bank_name,
            'bank_code': agent.monnify_bank_code
        })
    
    except Phone.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Device not found'
        }, status=404)
```

## Production Deployment

### Backend Checklist

- [ ] Store credentials in environment variables
- [ ] Register webhook URL with Monnify
- [ ] Implement signature verification
- [ ] Create reserved accounts during agent onboarding
- [ ] Test webhook reception in staging
- [ ] Monitor webhook logs
- [ ] Implement retry logic for failed webhook processing

### Mobile App Checklist

- [ ] Verify no Monnify credentials in code
- [ ] Test payment flow with sandbox
- [ ] Test polling timeout handling
- [ ] Test network error scenarios
- [ ] Add payment confirmation notifications
- [ ] Test on multiple Android versions

## Testing

### Sandbox Testing

1. **Create Test Reserved Account**
   ```bash
   # Via backend admin or management command
   python manage.py create_monnify_account --agent-id=1
   ```

2. **Test Payment Flow**
   - Open app, trigger settlement overlay
   - Note account number displayed
   - Make test transfer via Monnify sandbox
   - Verify webhook received
   - Confirm payment in app

3. **Test Edge Cases**
   - Partial payments
   - Multiple payments
   - Timeout scenarios
   - Network failures

## Troubleshooting

### Common Issues

**Issue:** "Device not found" error
- **Cause:** IMEI not registered in backend
- **Solution:** Ensure phone is registered to an agent

**Issue:** Payment not confirmed after transfer
- **Cause:** Webhook not received or processed
- **Solution:** Check backend logs, verify webhook URL configured in Monnify dashboard

**Issue:** Account creation fails
- **Cause:** Invalid email, missing required fields
- **Solution:** Check agent profile has valid email and business name

## Support

- **Monnify Documentation:** https://docs.monnify.com/
- **Monnify Support:** support@monnify.com
- **Backend API:** See `backend/README.md`

---

**Last Updated:** January 2026  
**Version:** 2.0 (Secure Backend Architecture)
