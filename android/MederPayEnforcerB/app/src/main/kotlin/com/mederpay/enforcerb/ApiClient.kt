package com.mederpay.enforcerb

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
}

object ApiClient {
    private val retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL)
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    val service: ApiService = retrofit.create(ApiService::class.java)
}
