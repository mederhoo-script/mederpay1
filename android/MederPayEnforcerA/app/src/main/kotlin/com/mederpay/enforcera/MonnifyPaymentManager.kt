package com.mederpay.enforcera

import android.app.Activity
import android.content.Context
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

/**
 * MonnifyPaymentManager - Handles payment flow coordination with backend.
 * 
 * IMPORTANT SECURITY NOTE:
 * This manager does NOT directly communicate with Monnify API.
 * All Monnify operations (authentication, account creation, payment processing)
 * are handled by the backend for security purposes.
 * 
 * The app's responsibility:
 * 1. Request reserved account details from backend
 * 2. Display account information to user
 * 3. Poll backend for payment confirmation
 * 4. Handle payment success/failure callbacks
 * 
 * Backend responsibilities:
 * - Store Monnify API credentials securely
 * - Authenticate with Monnify API
 * - Create and manage reserved accounts
 * - Handle Monnify webhooks for payment notifications
 * - Validate and confirm payments
 */
object MonnifyPaymentManager {
    private const val TAG = "MonnifyPaymentManager"
    
    private var isInitialized = false
    
    /**
     * Initialize payment manager
     * No credentials needed in app - backend handles all Monnify operations
     */
    fun initialize(context: Context) {
        Log.i(TAG, "Initializing MonnifyPaymentManager")
        isInitialized = true
        Log.i(TAG, "MonnifyPaymentManager initialized - Backend handles Monnify API")
    }
    
    /**
     * Fetch reserved account information from backend
     * Backend creates/retrieves the reserved account via Monnify API
     * 
     * @return ReservedAccountInfo with account details for display to user
     */
    suspend fun getReservedAccountInfo(context: Context): ReservedAccountInfo? = withContext(Dispatchers.IO) {
        try {
            Log.i(TAG, "Fetching reserved account info from backend")
            
            // Get device IMEI for backend identification
            val imei = android.provider.Settings.Secure.getString(
                context.contentResolver,
                android.provider.Settings.Secure.ANDROID_ID
            )
            
            // Backend API call to get reserved account
            // Backend will:
            // 1. Authenticate with Monnify using stored credentials
            // 2. Create or retrieve reserved account for this agent
            // 3. Return account details
            val response = ApiClient.service.getReservedAccount(imei)
            
            if (response.success) {
                Log.i(TAG, "Reserved account info retrieved: ${response.account_number}")
                return@withContext ReservedAccountInfo(
                    accountNumber = response.account_number,
                    accountName = response.account_name,
                    bankName = response.bank_name,
                    bankCode = response.bank_code
                )
            } else {
                Log.e(TAG, "Failed to get reserved account: ${response.message}")
                return@withContext null
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching reserved account info", e)
            return@withContext null
        }
    }
    
    /**
     * Initiate payment for weekly settlement
     * 
     * Flow:
     * 1. Get reserved account details from backend
     * 2. Display account information to user
     * 3. User makes bank transfer manually
     * 4. Poll backend for payment confirmation (backend receives webhook from Monnify)
     * 5. Call success callback when payment is confirmed
     * 
     * @param activity The calling activity
     * @param amount The settlement amount in Naira
     * @param settlementId The unique settlement identifier
     * @param onSuccess Callback when payment succeeds with payment reference
     * @param onFailure Callback when payment fails with error message
     * @param onCancelled Callback when user cancels payment
     */
    fun initiatePayment(
        activity: Activity,
        amount: Double,
        settlementId: String,
        onSuccess: (String) -> Unit,
        onFailure: (String) -> Unit,
        onCancelled: () -> Unit
    ) {
        Log.i(TAG, "Initiating payment - Amount: ₦$amount, Settlement: $settlementId")
        
        if (!isInitialized) {
            Log.e(TAG, "MonnifyPaymentManager not initialized")
            onFailure("Payment system not initialized. Please contact support.")
            return
        }
        
        if (amount <= 0) {
            Log.e(TAG, "Invalid payment amount: $amount")
            onFailure("Invalid payment amount")
            return
        }
        
        try {
            // Generate unique payment reference for tracking
            val paymentReference = generatePaymentReference(settlementId)
            
            // Start payment flow - get reserved account and display to user
            CoroutineScope(Dispatchers.Main).launch {
                try {
                    val accountInfo = getReservedAccountInfo(activity)
                    
                    if (accountInfo == null) {
                        onFailure("Unable to get payment account. Please try again.")
                        return@launch
                    }
                    
                    // Display account information to user
                    showPaymentAccountDialog(
                        activity = activity,
                        accountInfo = accountInfo,
                        amount = amount,
                        settlementId = settlementId,
                        paymentReference = paymentReference,
                        onConfirm = {
                            // User confirmed they made the transfer
                            // Start polling for payment confirmation
                            startPaymentPolling(
                                activity = activity,
                                settlementId = settlementId,
                                paymentReference = paymentReference,
                                onSuccess = onSuccess,
                                onFailure = onFailure
                            )
                        },
                        onCancel = onCancelled
                    )
                    
                } catch (e: Exception) {
                    Log.e(TAG, "Error in payment flow", e)
                    onFailure("Payment error: ${e.message}")
                }
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Error initiating payment", e)
            onFailure("Payment error: ${e.message}")
        }
    }
    
    /**
     * Display payment account information dialog
     */
    private fun showPaymentAccountDialog(
        activity: Activity,
        accountInfo: ReservedAccountInfo,
        amount: Double,
        settlementId: String,
        paymentReference: String,
        onConfirm: () -> Unit,
        onCancel: () -> Unit
    ) {
        activity.runOnUiThread {
            val message = """
                Make a bank transfer of ₦${String.format("%,.2f", amount)} to:
                
                Bank: ${accountInfo.bankName}
                Account Number: ${accountInfo.accountNumber}
                Account Name: ${accountInfo.accountName}
                
                Reference: $settlementId
                
                Payment will be confirmed automatically within minutes.
            """.trimIndent()
            
            val dialog = android.app.AlertDialog.Builder(activity)
                .setTitle("Weekly Settlement Payment")
                .setMessage(message)
                .setPositiveButton("I've Made Transfer") { _, _ ->
                    onConfirm()
                }
                .setNeutralButton("Copy Account Number") { _, _ ->
                    // Copy account number to clipboard
                    val clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                    val clip = android.content.ClipData.newPlainText("Account Number", accountInfo.accountNumber)
                    clipboard.setPrimaryClip(clip)
                    
                    android.widget.Toast.makeText(
                        activity,
                        "Account number copied",
                        android.widget.Toast.LENGTH_SHORT
                    ).show()
                    
                    // Show dialog again
                    showPaymentAccountDialog(
                        activity, accountInfo, amount, settlementId,
                        paymentReference, onConfirm, onCancel
                    )
                }
                .setNegativeButton("Cancel") { _, _ ->
                    onCancel()
                }
                .setCancelable(false)
                .create()
            
            dialog.show()
        }
    }
    
    /**
     * Poll backend for payment confirmation
     * Backend receives webhook from Monnify when payment is made
     */
    private fun startPaymentPolling(
        activity: Activity,
        settlementId: String,
        paymentReference: String,
        onSuccess: (String) -> Unit,
        onFailure: (String) -> Unit
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            Log.i(TAG, "Starting payment polling for settlement: $settlementId")
            
            var attempts = 0
            val maxAttempts = 60  // 5 minutes with 5-second intervals
            
            while (attempts < maxAttempts) {
                kotlinx.coroutines.delay(5000)  // Wait 5 seconds
                
                try {
                    // Check with backend if payment has been received
                    val imei = android.provider.Settings.Secure.getString(
                        activity.contentResolver,
                        android.provider.Settings.Secure.ANDROID_ID
                    )
                    
                    val status = ApiClient.service.getWeeklySettlement(imei)
                    
                    if (status.is_paid) {
                        // Payment confirmed by backend!
                        Log.i(TAG, "Payment confirmed! Reference: ${status.payment_reference}")
                        withContext(Dispatchers.Main) {
                            onSuccess(status.payment_reference ?: paymentReference)
                        }
                        return@launch
                    }
                    
                    attempts++
                    
                } catch (e: Exception) {
                    Log.e(TAG, "Error polling payment status", e)
                    attempts++
                }
            }
            
            // Timeout - payment not confirmed within expected time
            Log.w(TAG, "Payment polling timeout after ${maxAttempts * 5} seconds")
            withContext(Dispatchers.Main) {
                activity.runOnUiThread {
                    val dialog = android.app.AlertDialog.Builder(activity)
                        .setTitle("Payment Confirmation Pending")
                        .setMessage("We haven't received confirmation of your payment yet. This may take a few minutes. The app will continue checking in the background.")
                        .setPositiveButton("OK") { _, _ ->
                            // Continue polling in background
                            continueBackgroundPolling(activity, settlementId, paymentReference, onSuccess, onFailure)
                        }
                        .setCancelable(false)
                        .create()
                    dialog.show()
                }
            }
        }
    }
    
    /**
     * Continue polling in background for longer period
     */
    private fun continueBackgroundPolling(
        activity: Activity,
        settlementId: String,
        paymentReference: String,
        onSuccess: (String) -> Unit,
        onFailure: (String) -> Unit
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            // Poll for up to 30 minutes in background
            var attempts = 0
            val maxAttempts = 180  // 30 minutes with 10-second intervals
            
            while (attempts < maxAttempts) {
                kotlinx.coroutines.delay(10000)  // Wait 10 seconds
                
                try {
                    val imei = android.provider.Settings.Secure.getString(
                        activity.contentResolver,
                        android.provider.Settings.Secure.ANDROID_ID
                    )
                    
                    val status = ApiClient.service.getWeeklySettlement(imei)
                    
                    if (status.is_paid) {
                        Log.i(TAG, "Background polling: Payment confirmed!")
                        withContext(Dispatchers.Main) {
                            onSuccess(status.payment_reference ?: paymentReference)
                        }
                        return@launch
                    }
                    
                    attempts++
                    
                } catch (e: Exception) {
                    Log.e(TAG, "Error in background polling", e)
                    attempts++
                }
            }
            
            // Final timeout
            Log.e(TAG, "Background polling timeout - payment not confirmed")
            withContext(Dispatchers.Main) {
                onFailure("Payment confirmation timeout. Please contact support if you made the transfer.")
            }
        }
    }
    
    /**
     * Confirm payment with backend after successful transaction
     * Backend validates the payment with Monnify before confirming
     */
    fun confirmPaymentWithBackend(
        context: Context,
        settlementId: String,
        paymentReference: String,
        amount: Double
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                Log.i(TAG, "Confirming payment with backend - Ref: $paymentReference")
                
                // Get device IMEI
                val imei = android.provider.Settings.Secure.getString(
                    context.contentResolver,
                    android.provider.Settings.Secure.ANDROID_ID
                )
                
                // Call backend API to confirm payment
                // Backend will verify with Monnify before accepting
                val request = ConfirmSettlementPaymentRequest(
                    payment_reference = paymentReference,
                    amount = amount,
                    imei = imei
                )
                
                val response = ApiClient.service.confirmSettlementPayment(settlementId, request)
                
                if (response.success) {
                    Log.i(TAG, "Payment confirmed with backend: ${response.message}")
                    Log.i(TAG, "Billing status: ${response.billing_status}, Remaining: ${response.remaining_balance}")
                } else {
                    Log.e(TAG, "Failed to confirm payment: ${response.message}")
                }
                
                // Log audit event
                AuditLogger.log(context, "payment_backend_confirmation", mapOf(
                    "settlement_id" to settlementId,
                    "payment_reference" to paymentReference,
                    "amount" to amount.toString(),
                    "success" to response.success.toString()
                ))
                
            } catch (e: Exception) {
                Log.e(TAG, "Error confirming payment with backend", e)
            }
        }
    }
    
    /**
     * Generate unique payment reference
     */
    private fun generatePaymentReference(settlementId: String): String {
        val timestamp = System.currentTimeMillis()
        val uuid = UUID.randomUUID().toString().take(8)
        return "MEDERPAY-$settlementId-$timestamp-$uuid"
    }
    
    /**
     * Check if payment system is ready
     */
    fun isReady(): Boolean {
        return isInitialized
    }
    
    /**
     * Get payment manager status for diagnostics
     */
    fun getStatus(): Map<String, String> {
        return mapOf(
            "initialized" to isInitialized.toString(),
            "mode" to "backend_proxy"
        )
    }
}

/**
 * Data class for reserved account information (from backend)
 */
data class ReservedAccountInfo(
    val accountNumber: String,
    val accountName: String,
    val bankName: String,
    val bankCode: String
)
