# Monnify Payment Integration Guide

## Overview

The MederPay Enforcer A app integrates with Monnify payment gateway for weekly settlement enforcement. This document explains the integration, API usage, and deployment considerations.

## Monnify Configuration

### Test Credentials (Sandbox)
```
API Key: MK_TEST_7M5NZ5HX39
Secret Key: 0VCQQYWR4GLTLYDX1WYZDJABANLX6RVB
Contract Code: 2570907178
Base URL: https://sandbox.monnify.com
Wallet Account: 8415475129
```

### Production Credentials
Production credentials should be:
1. Fetched from the backend API per agent
2. Never hardcoded in the app
3. Stored securely using SecureStorage (encrypted)

## Integration Architecture

### 1. Authentication Flow

The app uses Monnify's REST API for authentication:

```kotlin
POST /api/v1/auth/login
Authorization: Basic base64(apiKey:secretKey)

Response:
{
  "requestSuccessful": true,
  "responseCode": 0,
  "responseBody": {
    "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
    "expiresIn": 3600
  }
}
```

**Implementation:**
- Authentication happens automatically when needed
- Access tokens are cached with 5-minute buffer before expiration
- Re-authentication is transparent to the caller

### 2. Payment Methods

#### Option A: Reserved Accounts (Recommended for MederPay)

Create a reserved account for each agent:

```kotlin
POST /api/v2/bank-transfer/reserved-accounts
Authorization: Bearer {accessToken}

{
  "accountReference": "agent-{agent_id}",
  "accountName": "MederPay Agent {name}",
  "currencyCode": "NGN",
  "contractCode": "2570907178",
  "customerEmail": "agent@email.com",
  "customerName": "Agent Name",
  "getAllAvailableBanks": true
}

Response:
{
  "requestSuccessful": true,
  "responseBody": {
    "accountNumber": "6254727989",
    "bankName": "Moniepoint Microfinance Bank",
    "bankCode": "50515",
    "reservationReference": "NWA7DMJ0W2UDK1KN5SLF",
    "status": "ACTIVE"
  }
}
```

**Benefits:**
- Agent gets a dedicated bank account number
- Customers can make transfers 24/7
- Automatic webhook notifications on payment
- No SDK integration required
- Works with all banks

**Flow:**
1. Create reserved account during agent onboarding
2. Store account details in backend
3. Display account number when settlement is due
4. User makes bank transfer manually
5. Monnify sends webhook to backend
6. Backend confirms payment and updates settlement

#### Option B: Checkout SDK (Alternative)

Use Monnify Android SDK for in-app checkout:

**Add Dependency:**
```kotlin
implementation("com.monnify.android:monnify-sdk:1.0.0")
```

**Initialize:**
```kotlin
Monnify.initialize(
    applicationContext = context,
    apiKey = apiKey,
    contractCode = contractCode,
    environment = ENVIRONMENT_TEST
)
```

**Initiate Payment:**
```kotlin
val transaction = TransactionDetails.Builder()
    .amount(BigDecimal.valueOf(amount))
    .customerName("Agent Name")
    .customerEmail("agent@email.com")
    .paymentReference(reference)
    .paymentDescription("Weekly Settlement")
    .currencyCode("NGN")
    .paymentMethods(listOf(PaymentMethod.CARD, PaymentMethod.BANK_TRANSFER))
    .build()

Monnify.getInstance().initializePayment(
    activity = activity,
    transactionDetails = transaction,
    paymentCallback = object : PaymentCallback {
        override fun onPaymentCompleted(response: TransactionResponse) {
            // Payment successful
        }
        override fun onPaymentFailed(response: TransactionResponse) {
            // Payment failed
        }
        override fun onPaymentCancelled() {
            // User cancelled
        }
    }
)
```

## Current Implementation

### MonnifyPaymentManager.kt

The current implementation in `MonnifyPaymentManager.kt`:

1. **Initialization:**
   - Automatically uses test credentials in debug mode
   - Production credentials should come from backend
   - Authenticates on first use

2. **Authentication:**
   - Basic Auth with base64(apiKey:secretKey)
   - Token caching with automatic renewal
   - 5-minute expiration buffer

3. **Reserved Account Creation:**
   - `createReservedAccount()` method implemented
   - Returns account number, bank name, bank code
   - Can be used during agent onboarding

4. **Payment Initiation:**
   - Currently uses simulation dialog for testing
   - Should be replaced with one of:
     - Display reserved account for manual transfer
     - Monnify Checkout SDK for in-app payment

5. **Payment Confirmation:**
   - `confirmPaymentWithBackend()` sends payment details to backend
   - Backend validates with Monnify
   - Updates settlement status

## Backend Integration Requirements

### 1. Agent Monnify Configuration API

Create endpoint to provide agent's Monnify credentials:

```kotlin
GET /api/agents/{agent_id}/monnify-config

Response:
{
  "api_key": "MK_PROD_...",
  "secret_key": "...",
  "contract_code": "...",
  "reserved_account_number": "1234567890",
  "reserved_account_bank": "Moniepoint",
  "reserved_account_name": "Agent Name"
}
```

### 2. Reserved Account Creation

Backend should:
1. Call Monnify API to create reserved account during agent onboarding
2. Store account details in Agent model
3. Provide account details to app via API

### 3. Webhook Handling

Backend must implement webhook endpoint to receive payment notifications:

```python
POST /webhooks/monnify/

{
  "eventType": "SUCCESSFUL_TRANSACTION",
  "transactionReference": "MNFY|...",
  "paymentReference": "MEDERPAY-...",
  "amountPaid": 5000.00,
  "paidOn": "2024-01-15T10:30:00",
  "accountNumber": "6254727989",
  "customerName": "Customer Name"
}
```

**Backend Actions:**
1. Verify webhook signature (Monnify provides signature)
2. Extract payment reference to identify settlement
3. Update settlement status to PAID
4. Update agent billing record
5. Send push notification to app (optional)
6. Return 200 OK to Monnify

### 4. Settlement Status API

App polls this endpoint to check if payment was confirmed:

```kotlin
GET /api/settlements/weekly/{imei}/

Response:
{
  "has_settlement": true,
  "is_due": false,  // Changed to false after payment
  "is_paid": true,
  "amount_due": 0.0,
  "payment_date": "2024-01-15T10:30:00",
  "payment_reference": "MEDERPAY-..."
}
```

## Production Deployment Steps

### 1. Backend Setup

1. Register for Monnify production account
2. Get production API keys and contract code
3. Store in environment variables (never in code)
4. Implement webhook endpoint with signature verification
5. Create reserved accounts for agents during onboarding
6. Store account details in database

### 2. App Configuration

1. Update `MonnifyPaymentManager.initialize()` call in `EnforcementService`
2. Fetch credentials from backend API
3. Remove test credentials from code
4. Test with production credentials in sandbox first
5. Switch to production base URL

### 3. Testing Checklist

- [ ] Authentication with production credentials
- [ ] Reserved account creation
- [ ] Payment webhook reception
- [ ] Settlement status update after payment
- [ ] Overlay dismissal after payment confirmation
- [ ] Audit logging of payment events
- [ ] Error handling for failed payments
- [ ] Network retry logic

## Security Considerations

### 1. Credentials Storage

- ✅ Never hardcode production credentials
- ✅ Fetch from backend API
- ✅ Store in SecureStorage (encrypted)
- ✅ Clear credentials on logout

### 2. API Communication

- ✅ Use HTTPS only
- ✅ Implement certificate pinning (recommended)
- ✅ Validate webhook signatures
- ✅ Log all payment events for audit

### 3. Payment Validation

- ✅ Always confirm payments with backend
- ✅ Never trust client-side payment status alone
- ✅ Implement duplicate payment detection
- ✅ Handle partial payments correctly

## Code Examples

### Initialize Monnify (Production)

```kotlin
// In Application onCreate or EnforcementService
lifecycleScope.launch {
    try {
        // Fetch configuration from backend
        val config = ApiClient.service.getAgentMonnifyConfig()
        
        // Initialize Monnify
        MonnifyPaymentManager.initialize(
            context = applicationContext,
            apiKey = config.api_key,
            secretKey = config.secret_key,
            contractCode = config.contract_code,
            useSandbox = false  // Production mode
        )
        
        // Authenticate
        MonnifyPaymentManager.fetchConfiguration(applicationContext)
        
    } catch (e: Exception) {
        Log.e(TAG, "Failed to initialize Monnify", e)
    }
}
```

### Display Reserved Account for Payment

```kotlin
// In PaymentOverlay when "Pay Now" is clicked
val accountInfo = ApiClient.service.getReservedAccountInfo()

val dialog = AlertDialog.Builder(this)
    .setTitle("Make Payment")
    .setMessage("""
        Transfer ₦${String.format("%,.2f", amount)} to:
        
        Bank: ${accountInfo.bank_name}
        Account Number: ${accountInfo.account_number}
        Account Name: ${accountInfo.account_name}
        
        Payment will be confirmed automatically.
    """.trimIndent())
    .setPositiveButton("I've Made Transfer") { _, _ ->
        // Start polling for payment confirmation
        startPaymentPolling(settlementId)
    }
    .setNegativeButton("Copy Account") { _, _ ->
        copyToClipboard(accountInfo.account_number)
        // Show dialog again
    }
    .setCancelable(false)
    .create()

dialog.show()
```

### Poll for Payment Confirmation

```kotlin
private fun startPaymentPolling(settlementId: String) {
    lifecycleScope.launch {
        var attempts = 0
        val maxAttempts = 60  // 5 minutes with 5-second intervals
        
        while (attempts < maxAttempts) {
            delay(5000)  // Wait 5 seconds
            
            val status = ApiClient.service.getWeeklySettlement(imei)
            
            if (status.is_paid) {
                // Payment confirmed!
                onSuccess(status.payment_reference ?: "")
                break
            }
            
            attempts++
        }
        
        if (attempts >= maxAttempts) {
            // Timeout - payment not confirmed
            showTimeoutMessage()
        }
    }
}
```

## Troubleshooting

### Common Issues

1. **Authentication Fails**
   - Check API key and secret key are correct
   - Verify base URL (sandbox vs production)
   - Ensure Basic Auth header is properly formatted

2. **Reserved Account Creation Fails**
   - Verify contract code is correct
   - Ensure all required fields are provided
   - Check email format is valid
   - Verify BVN/NIN format if provided

3. **Webhook Not Received**
   - Verify webhook URL is publicly accessible
   - Check webhook signature validation
   - Ensure 200 OK response is returned
   - Check Monnify dashboard for webhook logs

4. **Payment Not Confirmed**
   - Verify payment was made to correct account
   - Check payment amount matches settlement amount
   - Ensure payment reference is included in transfer
   - Check backend logs for webhook reception

## Support

- **Monnify Documentation:** https://docs.monnify.com/
- **Monnify Support:** support@monnify.com
- **MederPay Backend API:** See backend/README.md

---

**Last Updated:** January 2026  
**Version:** 1.0.0
