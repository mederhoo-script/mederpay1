package com.mederpay.enforcera

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
        val deviceId = DeviceManager.getIMEI(context)
        val appVersion = context.packageManager.getPackageInfo(context.packageName, 0).versionName
        
        val logsArray = JSONArray()
        for (log in logs) {
            val logObj = JSONObject().apply {
                put("event_type", log.event_type)
                put("timestamp", log.timestamp)
                put("event_data", JSONObject(log.event_data as Any))
            }
            logsArray.put(logObj)
        }
        
        return JSONObject().apply {
            put("imei", deviceId)
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
                    val obj = JSONObject(content)
                    val eventDataObj = obj.getJSONObject("event_data")
                    val eventData = mutableMapOf<String, String>()
                    eventDataObj.keys().forEach { key ->
                        eventData[key] = eventDataObj.getString(key)
                    }
                    
                    val entry = AuditLogEntry(
                        imei = obj.getString("imei"),
                        event_type = obj.getString("event_type"),
                        event_data = eventData,
                        timestamp = obj.getString("timestamp"),
                        app_version = obj.getString("app_version")
                    )
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
        // Delete all uploaded logs
        logsDir.listFiles()?.forEach { file ->
            if (file.name.endsWith(".json")) {
                file.delete()
            }
        }
    }
    
    /**
     * Store log locally for later upload
     */
    fun queueLog(context: Context, event_type: String, event_data: Map<String, String>, imei: String, appVersion: String) {
        try {
            val timestamp = dateFormat.format(Date())
            val entry = AuditLogEntry(
                imei = imei,
                event_type = event_type,
                event_data = event_data,
                timestamp = timestamp,
                app_version = appVersion
            )
            
            val logsDir = File(context.filesDir, "audit_logs")
            logsDir.mkdirs()
            
            val file = File(logsDir, "${imei}_${System.currentTimeMillis()}.json")
            file.writeText(entry.toJson())
            
            Log.d(TAG, "Queued log: $event_type")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to queue log", e)
        }
    }
}

/**
 * Extension function to serialize AuditLogEntry
 */
fun AuditLogEntry.toJson(): String {
    val obj = JSONObject().apply {
        put("imei", this@toJson.imei)
        put("event_type", this@toJson.event_type)
        put("timestamp", this@toJson.timestamp)
        put("event_data", JSONObject(this@toJson.event_data as Any))
        put("app_version", this@toJson.app_version)
    }
    return obj.toString()
}
