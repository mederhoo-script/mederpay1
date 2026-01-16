package com.mederpay.enforcera

import android.app.Activity
import android.content.Context
import android.util.Base64
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * MonnifyPaymentManager - Handles Monnify payment API integration.
 * 
 * Implements Monnify payment flow:
 * 1. Authenticate with API key and secret key to get access token
 * 2. Create reserved account or initiate payment transaction
 * 3. Handle payment callbacks and confirmations
 * 
 * Monnify API Documentation: https://docs.monnify.com/
 * 
 * Test Credentials (Sandbox):
 * - API Key: MK_TEST_7M5NZ5HX39
 * - Secret Key: 0VCQQYWR4GLTLYDX1WYZDJABANLX6RVB
 * - Contract Code: 2570907178
 * - Base URL: https://sandbox.monnify.com
 */
object MonnifyPaymentManager {
    private const val TAG = "MonnifyPaymentManager"
    
    // Monnify API configuration
    private const val MONNIFY_BASE_URL_SANDBOX = "https://sandbox.monnify.com"
    private const val MONNIFY_BASE_URL_LIVE = "https://api.monnify.com"
    
    // Test credentials (for sandbox environment)
    private const val TEST_API_KEY = "MK_TEST_7M5NZ5HX39"
    private const val TEST_SECRET_KEY = "0VCQQYWR4GLTLYDX1WYZDJABANLX6RVB"
    private const val TEST_CONTRACT_CODE = "2570907178"
    
    // Production credentials (would come from backend)
    private var monnifyApiKey: String? = null
    private var monnifySecretKey: String? = null
    private var monnifyContractCode: String? = null
    private var monnifyBaseUrl: String = MONNIFY_BASE_URL_SANDBOX
    private var accessToken: String? = null
    private var tokenExpiresAt: Long = 0L
    private var isInitialized = false
    
    // HTTP client for API calls
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()
    
    /**
     * Initialize Monnify with credentials
     * Uses test credentials for sandbox by default, production credentials should come from backend
     */
    fun initialize(
        context: Context, 
        apiKey: String? = null, 
        secretKey: String? = null,
        contractCode: String? = null,
        useSandbox: Boolean = BuildConfig.DEBUG
    ) {
        Log.i(TAG, "Initializing Monnify - Sandbox: $useSandbox")
        
        // Use provided credentials or fall back to test credentials in sandbox mode
        monnifyApiKey = apiKey ?: if (useSandbox) TEST_API_KEY else null
        monnifySecretKey = secretKey ?: if (useSandbox) TEST_SECRET_KEY else null
        monnifyContractCode = contractCode ?: if (useSandbox) TEST_CONTRACT_CODE else null
        monnifyBaseUrl = if (useSandbox) MONNIFY_BASE_URL_SANDBOX else MONNIFY_BASE_URL_LIVE
        
        if (monnifyApiKey == null || monnifySecretKey == null || monnifyContractCode == null) {
            Log.e(TAG, "Monnify credentials not configured")
            isInitialized = false
            return
        }
        
        isInitialized = true
        Log.i(TAG, "Monnify initialized successfully - Base URL: $monnifyBaseUrl")
    }
    
    /**
     * Authenticate with Monnify API to get access token
     * POST /api/v1/auth/login
     */
    private suspend fun authenticate(): Boolean = withContext(Dispatchers.IO) {
        try {
            // Check if we already have a valid token
            if (accessToken != null && System.currentTimeMillis() < tokenExpiresAt) {
                Log.d(TAG, "Using cached access token")
                return@withContext true
            }
            
            Log.i(TAG, "Authenticating with Monnify API")
            
            // Create Basic Auth header: "Basic base64(apiKey:secretKey)"
            val credentials = "$monnifyApiKey:$monnifySecretKey"
            val base64Credentials = Base64.encodeToString(
                credentials.toByteArray(),
                Base64.NO_WRAP
            )
            val authHeader = "Basic $base64Credentials"
            
            // Build request
            val request = Request.Builder()
                .url("$monnifyBaseUrl/api/v1/auth/login")
                .post("".toByteArray().toRequestBody())
                .addHeader("Authorization", authHeader)
                .build()
            
            // Execute request
            val response = httpClient.newCall(request).execute()
            val responseBody = response.body?.string()
            
            if (!response.isSuccessful || responseBody == null) {
                Log.e(TAG, "Authentication failed: ${response.code} - ${response.message}")
                return@withContext false
            }
            
            // Parse response
            val json = JSONObject(responseBody)
            val requestSuccessful = json.getBoolean("requestSuccessful")
            
            if (!requestSuccessful) {
                Log.e(TAG, "Authentication request unsuccessful")
                return@withContext false
            }
            
            val responseBodyObj = json.getJSONObject("responseBody")
            accessToken = responseBodyObj.getString("accessToken")
            val expiresIn = responseBodyObj.getInt("expiresIn")
            
            // Set token expiration time (with 5 minute buffer)
            tokenExpiresAt = System.currentTimeMillis() + ((expiresIn - 300) * 1000L)
            
            Log.i(TAG, "Authentication successful - Token expires in ${expiresIn}s")
            return@withContext true
            
        } catch (e: Exception) {
            Log.e(TAG, "Authentication error", e)
            accessToken = null
            tokenExpiresAt = 0L
            return@withContext false
        }
    }
    
    /**
     * Fetch Monnify configuration from backend
     * In production, this would retrieve agent-specific Monnify credentials
     */
    suspend fun fetchConfiguration(context: Context) {
        try {
            Log.i(TAG, "Fetching Monnify configuration from backend")
            
            // TODO: In production, implement API call to fetch agent's Monnify credentials
            // val response = ApiClient.service.getAgentMonnifyConfig()
            // if (response.success) {
            //     initialize(
            //         context = context,
            //         apiKey = response.apiKey,
            //         secretKey = response.secretKey,
            //         contractCode = response.contractCode,
            //         useSandbox = false
            //     )
            // }
            
            // For now, use test credentials in sandbox mode
            initialize(
                context = context,
                useSandbox = true
            )
            
            // Authenticate immediately to verify credentials
            val authenticated = authenticate()
            if (!authenticated) {
                Log.e(TAG, "Failed to authenticate with Monnify")
                throw Exception("Monnify authentication failed")
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to fetch Monnify configuration", e)
            throw e
        }
    }
    
    /**
     * Create a reserved account for the agent
     * This allows customers to pay directly to an account assigned to the agent
     * 
     * POST /api/v2/bank-transfer/reserved-accounts
     */
    suspend fun createReservedAccount(
        context: Context,
        accountReference: String,
        accountName: String,
        customerEmail: String,
        customerName: String,
        bvn: String? = null,
        nin: String? = null
    ): ReservedAccountResponse? = withContext(Dispatchers.IO) {
        try {
            // Authenticate first
            if (!authenticate()) {
                Log.e(TAG, "Failed to authenticate before creating reserved account")
                return@withContext null
            }
            
            Log.i(TAG, "Creating reserved account for: $accountReference")
            
            // Build request body
            val jsonBody = JSONObject().apply {
                put("accountReference", accountReference)
                put("accountName", accountName)
                put("currencyCode", "NGN")
                put("contractCode", monnifyContractCode)
                put("customerEmail", customerEmail)
                put("customerName", customerName)
                put("getAllAvailableBanks", true)
                if (bvn != null) put("bvn", bvn)
                if (nin != null) put("nin", nin)
            }
            
            val requestBody = jsonBody.toString().toRequestBody("application/json".toMediaType())
            
            // Build request
            val request = Request.Builder()
                .url("$monnifyBaseUrl/api/v2/bank-transfer/reserved-accounts")
                .post(requestBody)
                .addHeader("Content-Type", "application/json")
                .addHeader("Authorization", "Bearer $accessToken")
                .build()
            
            // Execute request
            val response = httpClient.newCall(request).execute()
            val responseBody = response.body?.string()
            
            if (!response.isSuccessful || responseBody == null) {
                Log.e(TAG, "Failed to create reserved account: ${response.code}")
                return@withContext null
            }
            
            // Parse response
            val json = JSONObject(responseBody)
            val requestSuccessful = json.getBoolean("requestSuccessful")
            
            if (!requestSuccessful) {
                Log.e(TAG, "Reserved account creation unsuccessful")
                return@withContext null
            }
            
            val responseBodyObj = json.getJSONObject("responseBody")
            val accountsArray = responseBodyObj.getJSONArray("accounts")
            
            if (accountsArray.length() == 0) {
                Log.e(TAG, "No accounts returned")
                return@withContext null
            }
            
            val firstAccount = accountsArray.getJSONObject(0)
            val reservedAccount = ReservedAccountResponse(
                accountReference = responseBodyObj.getString("accountReference"),
                accountName = responseBodyObj.getString("accountName"),
                accountNumber = firstAccount.getString("accountNumber"),
                bankName = firstAccount.getString("bankName"),
                bankCode = firstAccount.getString("bankCode"),
                reservationReference = responseBodyObj.getString("reservationReference"),
                status = responseBodyObj.getString("status")
            )
            
            Log.i(TAG, "Reserved account created: ${reservedAccount.accountNumber}")
            return@withContext reservedAccount
            
        } catch (e: Exception) {
            Log.e(TAG, "Error creating reserved account", e)
            return@withContext null
        }
    }
    
    /**
     * Initiate a one-time dynamic payment for weekly settlement
     * 
     * For now, uses a simulation dialog. In production with reserved accounts:
     * 1. Display reserved account number to user
     * 2. User makes bank transfer to the account
     * 3. Webhook notification received when payment is confirmed
     * 4. Backend confirms payment and updates settlement status
     * 
     * Alternative: Integrate with Monnify Checkout for card/bank transfer UI
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
            Log.e(TAG, "Monnify not initialized")
            onFailure("Payment system not initialized. Please contact support.")
            return
        }
        
        if (amount <= 0) {
            Log.e(TAG, "Invalid payment amount: $amount")
            onFailure("Invalid payment amount")
            return
        }
        
        try {
            // Generate unique payment reference
            val paymentReference = generatePaymentReference(settlementId)
            
            // For production with Monnify Checkout SDK:
            // 1. Add Monnify Android SDK dependency
            // 2. Initialize checkout with amount, customer details, payment reference
            // 3. Handle callbacks for success/failure/cancellation
            
            // For production with reserved accounts:
            // 1. Show dialog with reserved account details
            // 2. User makes transfer manually
            // 3. Wait for webhook confirmation from Monnify
            // 4. Polling mechanism to check payment status
            
            // TEMPORARY: Simulation for testing (remove in production)
            Log.w(TAG, "Using SIMULATION - Replace with actual Monnify integration")
            simulatePaymentFlow(activity, paymentReference, amount, onSuccess, onFailure, onCancelled)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error initiating payment", e)
            onFailure("Payment error: ${e.message}")
        }
    }
    
    /**
     * Confirm payment with backend after successful Monnify transaction
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
     * Get customer name for payment (from device/backend)
     */
    private fun getCustomerName(context: Context): String {
        // TODO: Fetch from backend or stored agent profile
        return "MederPay Agent"
    }
    
    /**
     * Get customer email for payment (from device/backend)
     */
    private fun getCustomerEmail(context: Context): String {
        // TODO: Fetch from backend or stored agent profile
        return "agent@mederpay.com"
    }
    
    /**
     * TEMPORARY: Simulate payment flow for testing
     * REMOVE this method in production and use actual Monnify integration
     */
    private fun simulatePaymentFlow(
        activity: Activity,
        paymentReference: String,
        amount: Double,
        onSuccess: (String) -> Unit,
        onFailure: (String) -> Unit,
        onCancelled: () -> Unit
    ) {
        Log.w(TAG, "SIMULATING PAYMENT FLOW - This is for testing only")
        
        // Show dialog to simulate payment
        activity.runOnUiThread {
            val dialog = android.app.AlertDialog.Builder(activity)
                .setTitle("Payment Simulation")
                .setMessage("Test payment for weekly settlement\n\nAmount: ₦${String.format("%,.2f", amount)}\nReference: $paymentReference\n\nSelect payment outcome:")
                .setPositiveButton("Success") { _, _ ->
                    Log.i(TAG, "Simulated payment SUCCESS")
                    onSuccess(paymentReference)
                }
                .setNegativeButton("Failure") { _, _ ->
                    Log.i(TAG, "Simulated payment FAILURE")
                    onFailure("Simulated payment failure")
                }
                .setNeutralButton("Cancel") { _, _ ->
                    Log.i(TAG, "Simulated payment CANCELLED")
                    onCancelled()
                }
                .setCancelable(false)
                .create()
            
            dialog.show()
        }
    }
    
    /**
     * Check if payment system is ready
     */
    fun isReady(): Boolean {
        return isInitialized && accessToken != null
    }
    
    /**
     * Get Monnify status for diagnostics
     */
    fun getStatus(): Map<String, String> {
        return mapOf(
            "initialized" to isInitialized.toString(),
            "has_api_key" to (monnifyApiKey != null).toString(),
            "has_secret_key" to (monnifySecretKey != null).toString(),
            "has_contract_code" to (monnifyContractCode != null).toString(),
            "has_access_token" to (accessToken != null).toString(),
            "token_valid" to (System.currentTimeMillis() < tokenExpiresAt).toString(),
            "base_url" to monnifyBaseUrl
        )
    }
}

/**
 * Data class for reserved account response
 */
data class ReservedAccountResponse(
    val accountReference: String,
    val accountName: String,
    val accountNumber: String,
    val bankName: String,
    val bankCode: String,
    val reservationReference: String,
    val status: String
)
