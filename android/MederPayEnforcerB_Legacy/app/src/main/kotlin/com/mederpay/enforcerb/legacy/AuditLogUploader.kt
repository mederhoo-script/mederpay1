package com.mederpay.enforcerb.legacy

import android.content.Context
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

/**
 * Uploads audit logs to backend API
 * Integrates with backend/apps/audit/device_views.py endpoint
 * 
 * Features:
 * - Batch upload (efficient)
 * - Retry logic with exponential backoff
 * - Persistent queue (survives app restart)
 * - Automatic upload scheduling
 */
object AuditLogUploader {
    
    private const val TAG = "AuditLogUploader"
    private const val UPLOAD_ENDPOINT = "/api/audit/device-logs/batch/"
    private const val MAX_BATCH_SIZE = 50
    private const val MAX_RETRIES = 3
    private const val INITIAL_BACKOFF_MS = 5000L
    
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    
    /**
     * Upload pending logs to backend
     * Called periodically by EnforcementService
     */
    fun uploadPendingLogs(context: Context) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val logs = getPendingLogs(context)
                if (logs.isEmpty()) {
                    Log.d(TAG, "No pending logs to upload")
                    return@launch
                }
                
                Log.i(TAG, "Uploading ${logs.size} pending logs")
                
                // Upload in batches
                val batches = logs.chunked(MAX_BATCH_SIZE)
                for ((index, batch) in batches.withIndex()) {
                    uploadBatch(context, batch, index + 1, batches.size)
                }
                
                Log.i(TAG, "Successfully uploaded all pending logs")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to upload pending logs", e)
            }
        }
    }
    
    /**
     * Upload a single batch with retry logic
     */
    private suspend fun uploadBatch(
        context: Context,
        logs: List<AuditLogEntry>,
        batchNumber: Int,
        totalBatches: Int
    ) {
        var attempt = 0
        var backoffMs = INITIAL_BACKOFF_MS
        
        while (attempt < MAX_RETRIES) {
            try {
                Log.d(TAG, "Uploading batch $batchNumber/$totalBatches (attempt ${attempt + 1})")
                
                val payload = buildBatchPayload(context, logs)
                val response = ApiClient.service.uploadAuditLogsBatch(payload)
                
                if (response.isSuccessful) {
                    // Mark logs as uploaded
                    markLogsUploaded(context, logs)
                    Log.i(TAG, "Batch $batchNumber uploaded successfully")
                    return
                } else {
                    Log.w(TAG, "Upload failed with HTTP ${response.code()}: ${response.message()}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Upload attempt ${attempt + 1} failed", e)
            }
            
            attempt++
            if (attempt < MAX_RETRIES) {
                Log.d(TAG, "Retrying in ${backoffMs}ms...")
                kotlinx.coroutines.delay(backoffMs)
                backoffMs *= 2 // Exponential backoff
            }
        }
        
        Log.e(TAG, "Failed to upload batch $batchNumber after $MAX_RETRIES attempts")
    }
    
    /**
     * Build JSON payload for batch upload
     */
    private fun buildBatchPayload(context: Context, logs: List<AuditLogEntry>): JSONObject {
        val deviceId = SecureStorage.getDeviceId(context)
        val appVersion = context.packageManager.getPackageInfo(context.packageName, 0).versionName
        
        val logsArray = JSONArray()
        for (log in logs) {
            val logObj = JSONObject().apply {
                put("event", log.event)
                put("timestamp", dateFormat.format(log.timestamp))
                put("data", JSONObject(log.data))
            }
            logsArray.put(logObj)
        }
        
        return JSONObject().apply {
            put("device_id", deviceId)
            put("app_version", appVersion)
            put("logs", logsArray)
        }
    }
    
    /**
     * Get pending logs from local storage
     */
    private fun getPendingLogs(context: Context): List<AuditLogEntry> {
        val logsDir = File(context.filesDir, "audit_logs")
        if (!logsDir.exists()) return emptyList()
        
        val logs = mutableListOf<AuditLogEntry>()
        logsDir.listFiles()?.forEach { file ->
            if (file.name.endsWith(".json")) {
                try {
                    val content = file.readText()
                    val entry = AuditLogEntry.fromJson(content)
                    logs.add(entry)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to read log file: ${file.name}", e)
                }
            }
        }
        
        return logs.sortedBy { it.timestamp }
    }
    
    /**
     * Mark logs as uploaded (delete from local storage)
     */
    private fun markLogsUploaded(context: Context, logs: List<AuditLogEntry>) {
        val logsDir = File(context.filesDir, "audit_logs")
        logs.forEach { log ->
            val file = File(logsDir, "${log.id}.json")
            if (file.exists()) {
                file.delete()
            }
        }
    }
    
    /**
     * Store log locally for later upload
     */
    fun queueLog(context: Context, event: String, data: Map<String, Any>) {
        try {
            val entry = AuditLogEntry(
                id = UUID.randomUUID().toString(),
                event = event,
                timestamp = Date(),
                data = data
            )
            
            val logsDir = File(context.filesDir, "audit_logs")
            logsDir.mkdirs()
            
            val file = File(logsDir, "${entry.id}.json")
            file.writeText(entry.toJson())
            
            Log.d(TAG, "Queued log: $event")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to queue log", e)
        }
    }
}

/**
 * Audit log entry data class
 */
data class AuditLogEntry(
    val id: String,
    val event: String,
    val timestamp: Date,
    val data: Map<String, Any>
) {
    fun toJson(): String {
        val obj = JSONObject().apply {
            put("id", id)
            put("event", event)
            put("timestamp", timestamp.time)
            put("data", JSONObject(data))
        }
        return obj.toString()
    }
    
    companion object {
        fun fromJson(json: String): AuditLogEntry {
            val obj = JSONObject(json)
            val dataObj = obj.getJSONObject("data")
            val data = mutableMapOf<String, Any>()
            dataObj.keys().forEach { key ->
                data[key] = dataObj.get(key)
            }
            
            return AuditLogEntry(
                id = obj.getString("id"),
                event = obj.getString("event"),
                timestamp = Date(obj.getLong("timestamp")),
                data = data
            )
        }
    }
}
