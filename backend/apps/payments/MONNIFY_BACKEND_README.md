# Monnify Payment Integration - Backend Implementation

## Overview

This directory contains the complete backend implementation for Monnify payment gateway integration. All Monnify API operations are handled securely on the backend, never exposing credentials to mobile apps.

## Files Created

### Models (`monnify_models.py`)
- **MonnifyReservedAccount**: Stores reserved account details for each agent
- **MonnifyWebhookLog**: Logs all webhook events from Monnify for audit
- **WeeklySettlement**: Tracks weekly settlement obligations for agents
- **SettlementPayment**: Records individual payments towards settlements

### Service (`monnify_service.py`)
- **MonnifyService**: Handles all Monnify API communication
  - Authentication with token caching
  - Reserved account creation
  - Webhook signature verification
  - Transaction status queries

### Views (`monnify_views.py`)
- **get_reserved_account**: API endpoint for mobile app to get account details
- **monnify_webhook**: Webhook handler for payment notifications
- **get_weekly_settlement**: API endpoint for settlement status polling

### URLs
- **monnify_urls.py**: Mobile app API endpoints
- **monnify_webhook_urls.py**: Webhook endpoint

### Admin (`monnify_admin.py`)
- Django admin interfaces for all Monnify models

### Migration (`migrations/0004_monnify_integration.py`)
- Database migration for all Monnify tables

## Setup Instructions

### 1. Environment Variables

Add to your `.env` file:

```bash
# Monnify Payment Gateway (TEST credentials)
MONNIFY_API_KEY=MK_TEST_7M5NZ5HX39
MONNIFY_SECRET_KEY=0VCQQYWR4GLTLYDX1WYZDJABANLX6RVB
MONNIFY_CONTRACT_CODE=2570907178
MONNIFY_BASE_URL=https://sandbox.monnify.com
MONNIFY_WEBHOOK_SECRET=your-webhook-secret-here
```

**⚠️ Important:** Replace with production credentials before deploying!

### 2. Run Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

### 3. Configure Webhook URL

Register your webhook URL with Monnify:
```
https://your-domain.com/webhooks/monnify/
```

Get the webhook secret from Monnify dashboard and add to `.env`.

### 4. Create Logs Directory

```bash
mkdir -p logs
```

## API Endpoints

### For Mobile App

#### Get Reserved Account
```
GET /api/monnify/reserved-account/{imei}/

Response:
{
  "success": true,
  "account_number": "6254727989",
  "account_name": "Agent Business Name",
  "bank_name": "Moniepoint Microfinance Bank",
  "bank_code": "50515"
}
```

#### Get Weekly Settlement Status
```
GET /api/settlements/weekly/{imei}/

Response:
{
  "has_settlement": true,
  "is_due": true,
  "is_paid": false,
  "is_overdue": false,
  "settlement_id": "123",
  "amount_due": 5000.00,
  "total_amount": 5000.00,
  "amount_paid": 0.00,
  "due_date": "2026-01-20",
  "invoice_number": "INV-2026-01-001",
  "message": "Payment of ₦5000.00 is due."
}
```

### For Monnify Webhooks

#### Payment Notification
```
POST /webhooks/monnify/
Headers:
  Monnify-Signature: <signature>

Body:
{
  "eventType": "SUCCESSFUL_TRANSACTION",
  "transactionReference": "MNFY|20260115|123456",
  "accountNumber": "6254727989",
  "amountPaid": 5000.00,
  "paymentReference": "MEDERPAY-123-...",
  "customerName": "Customer Name",
  "paidOn": "2026-01-15T10:30:00Z"
}

Response:
{
  "status": "success"
}
```

## Testing

### Test Reserved Account Creation

```python
from apps.payments.monnify_service import monnify_service

result = monnify_service.create_reserved_account(
    account_reference="agent-1",
    account_name="Test Agent",
    customer_email="test@example.com",
    customer_name="Test Agent"
)

print(f"Account Number: {result['account_number']}")
print(f"Bank: {result['bank_name']}")
```

### Test Webhook Processing

```bash
curl -X POST http://localhost:8000/webhooks/monnify/ \
  -H "Content-Type: application/json" \
  -H "Monnify-Signature: test-signature" \
  -d '{
    "eventType": "SUCCESSFUL_TRANSACTION",
    "transactionReference": "TEST123",
    "accountNumber": "6254727989",
    "amountPaid": 1000.00,
    "paidOn": "2026-01-15T10:00:00Z"
  }'
```

## Creating Weekly Settlements

Weekly settlements must be created via Django admin or management command:

```python
from django.utils import timezone
from datetime import date, timedelta
from apps.platform.models import Agent
from apps.payments.monnify_models import WeeklySettlement

agent = Agent.objects.get(id=1)
today = date.today()
week_start = today - timedelta(days=today.weekday())
week_end = week_start + timedelta(days=6)

settlement = WeeklySettlement.objects.create(
    agent=agent,
    week_starting=week_start,
    week_ending=week_end,
    total_amount=5000.00,
    due_date=week_end + timedelta(days=3),
    invoice_number=f"INV-{week_end.strftime('%Y-%m')}-001"
)
```

## Payment Flow

1. **Agent Onboarding**: Reserved account created automatically when first accessed
2. **Weekly Settlement**: Created by admin/system for agent
3. **Payment Request**: Mobile app requests account details
4. **Display**: App shows account number to user
5. **Transfer**: User makes bank transfer to displayed account
6. **Webhook**: Monnify notifies backend of payment
7. **Processing**: Backend updates settlement status
8. **Confirmation**: Mobile app polls and receives confirmation

## Monitoring

### Check Webhook Logs

```python
from apps.payments.monnify_models import MonnifyWebhookLog

# Recent webhooks
MonnifyWebhookLog.objects.order_by('-received_at')[:10]

# Failed processing
MonnifyWebhookLog.objects.filter(processed=False)

# By account
MonnifyWebhookLog.objects.filter(account_number='6254727989')
```

### Check Settlements

```python
from apps.payments.monnify_models import WeeklySettlement

# Pending settlements
WeeklySettlement.objects.filter(status='PENDING')

# Overdue
WeeklySettlement.objects.filter(
    status='PENDING',
    due_date__lt=timezone.now().date()
)
```

## Security Notes

1. **Never expose credentials**: All Monnify credentials stay on backend
2. **Verify signatures**: All webhooks signatures are verified
3. **HTTPS only**: Webhooks must be HTTPS in production
4. **Environment variables**: Use `.env` files, never commit secrets
5. **Audit trail**: All webhooks logged for security audit

## Troubleshooting

### Account creation fails
- Check API credentials in `.env`
- Verify Monnify API is reachable
- Check agent email is valid
- Review logs in `logs/monnify.log`

### Webhook not received
- Verify webhook URL is publicly accessible (HTTPS)
- Check Monnify dashboard for webhook configuration
- Ensure webhook secret is correct
- Review `MonnifyWebhookLog` for errors

### Payment not confirmed
- Check webhook was received (`MonnifyWebhookLog`)
- Verify account number matches
- Check settlement exists and is PENDING
- Review webhook processing errors

## Production Deployment

### Checklist

- [ ] Replace test credentials with production Monnify credentials
- [ ] Configure production webhook URL in Monnify dashboard
- [ ] Add webhook secret to production environment
- [ ] Enable HTTPS for all endpoints
- [ ] Set up log monitoring for errors
- [ ] Test account creation in production
- [ ] Test webhook with real payment
- [ ] Monitor first few transactions closely

---

**Last Updated:** January 2026
**Version:** 1.0.0
