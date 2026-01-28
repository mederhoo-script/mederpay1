package com.mederpay.enforcera

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*

data class EnforcementStatus(
    val should_lock: Boolean,
    val reason: String,
    val balance: Double,
    val overdue_count: Int
)

data class HealthCheckRequest(
    val imei: String,
    val is_device_admin_enabled: Boolean,
    val is_companion_app_installed: Boolean,
    val companion_app_version: String?,
    val android_version: String,
    val app_version: String,
    val battery_level: Int?,
    val is_locked: Boolean,
    val lock_reason: String?
)

data class DeviceCommand(
    val id: Int,
    val command_type: String,
    val reason: String,
    val expires_at: String
)

data class AuditLogEntry(
    val imei: String,
    val event_type: String,
    val event_data: Map<String, String>,
    val timestamp: String,
    val app_version: String
)

data class AuditLogResponse(
    val success: Boolean,
    val message: String?
)

data class WeeklySettlementResponse(
    val has_settlement: Boolean,
    val is_due: Boolean,
    val is_overdue: Boolean,
    val is_paid: Boolean = false,
    val payment_reference: String? = null,
    val settlement_id: String?,
    val amount_due: Double?,
    val total_amount: Double?,
    val amount_paid: Double?,
    val due_date: String?,
    val invoice_number: String?,
    val message: String?
)

data class ConfirmSettlementPaymentRequest(
    val payment_reference: String,
    val amount: Double,
    val imei: String
)

data class ConfirmSettlementPaymentResponse(
    val success: Boolean,
    val message: String,
    val payment_id: Int?,
    val billing_status: String?,
    val remaining_balance: Double?
)

data class ReservedAccountResponse(
    val success: Boolean,
    val message: String?,
    val account_number: String,
    val account_name: String,
    val bank_name: String,
    val bank_code: String
)

interface ApiService {
    @GET("enforcement/status/{imei}/")
    suspend fun getEnforcementStatus(@Path("imei") imei: String): EnforcementStatus

    @POST("enforcement/health-check/")
    suspend fun sendHealthCheck(@Body request: HealthCheckRequest)

    @GET("device-commands/pending/")
    suspend fun getPendingCommands(@Query("imei") imei: String): List<DeviceCommand>

    @POST("device-commands/{id}/acknowledge/")
    suspend fun acknowledgeCommand(@Path("id") commandId: Int)

    @POST("device-commands/{id}/execute/")
    suspend fun executeCommand(@Path("id") commandId: Int, @Body response: Map<String, String>)

    @POST("enforcement/audit-log/")
    suspend fun sendAuditLog(@Body log: AuditLogEntry): AuditLogResponse

    @POST("enforcement/audit-logs/batch/")
    suspend fun sendAuditLogBatch(@Body logs: List<AuditLogEntry>): AuditLogResponse
    
    // Settlement endpoints
    @GET("settlements/weekly/{imei}/")
    suspend fun getWeeklySettlement(@Path("imei") imei: String): WeeklySettlementResponse
    
    @POST("settlements/{settlement_id}/confirm/")
    suspend fun confirmSettlementPayment(
        @Path("settlement_id") settlementId: String,
        @Body request: ConfirmSettlementPaymentRequest
    ): ConfirmSettlementPaymentResponse
    
    // Monnify reserved account endpoint
    // Backend handles Monnify API communication securely
    @GET("monnify/reserved-account/{imei}/")
    suspend fun getReservedAccount(@Path("imei") imei: String): ReservedAccountResponse
}

object ApiClient {
    private val retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL)
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    val service: ApiService = retrofit.create(ApiService::class.java)
}
