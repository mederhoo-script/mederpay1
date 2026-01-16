package com.mederpay.enforcerb

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.util.Log
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.*
import java.text.SimpleDateFormat
import java.util.*

/**
 * AuditLogger handles audit log transmission with retry logic and offline queueing.
 */
object AuditLogger {
    private const val TAG = "AuditLogger"
    private const val PREFS_NAME = "audit_logs"
    private const val KEY_QUEUED_LOGS = "queued_logs"
    private const val MAX_QUEUE_SIZE = 100
    private const val MAX_RETRY_ATTEMPTS = 3
    private const val RETRY_DELAY_MS = 5000L

    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    /**
     * Log an audit event and attempt to send to backend
     */
    fun logEvent(
        context: Context,
        imei: String,
        eventType: String,
        eventData: Map<String, String> = emptyMap()
    ) {
        scope.launch {
            try {
                val logEntry = createLogEntry(context, imei, eventType, eventData)
                
                // Try to send immediately
                val sent = sendLog(logEntry)
                
                if (!sent) {
                    // Queue for later if send failed
                    queueLog(context, logEntry)
                    Log.w(TAG, "Audit log queued for later transmission: $eventType")
                } else {
                    Log.d(TAG, "Audit log sent successfully: $eventType")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to log audit event: $eventType", e)
            }
        }
    }

    /**
     * Process queued logs and attempt to send them
     */
    fun processQueuedLogs(context: Context) {
        scope.launch {
            try {
                val queuedLogs = getQueuedLogs(context)
                if (queuedLogs.isEmpty()) {
                    return@launch
                }

                Log.i(TAG, "Processing ${queuedLogs.size} queued audit logs")

                val successfulLogs = mutableListOf<AuditLogEntry>()
                
                // Try to send in batch
                try {
                    val response = ApiClient.service.sendAuditLogBatch(queuedLogs)
                    if (response.success) {
                        successfulLogs.addAll(queuedLogs)
                        Log.i(TAG, "Batch audit logs sent successfully")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Batch send failed, trying individual logs", e)
                    
                    // Fallback: send individually
                    for (log in queuedLogs) {
                        if (sendLog(log)) {
                            successfulLogs.add(log)
                        }
                    }
                }

                // Remove successfully sent logs from queue
                if (successfulLogs.isNotEmpty()) {
                    removeFromQueue(context, successfulLogs)
                    Log.i(TAG, "Removed ${successfulLogs.size} sent logs from queue")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to process queued logs", e)
            }
        }
    }

    /**
     * Create a log entry with current timestamp and device info
     */
    private fun createLogEntry(
        context: Context,
        imei: String,
        eventType: String,
        eventData: Map<String, String>
    ): AuditLogEntry {
        val timestamp = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())

        return AuditLogEntry(
            imei = imei,
            event_type = eventType,
            event_data = eventData,
            timestamp = timestamp,
            app_version = BuildConfig.VERSION_NAME
        )
    }

    /**
     * Send a single log entry to backend with retry logic
     */
    private suspend fun sendLog(logEntry: AuditLogEntry): Boolean {
        var attempts = 0
        
        while (attempts < MAX_RETRY_ATTEMPTS) {
            try {
                val response = ApiClient.service.sendAuditLog(logEntry)
                if (response.success) {
                    return true
                }
                Log.w(TAG, "Audit log send failed: ${response.message}")
            } catch (e: Exception) {
                Log.w(TAG, "Audit log send attempt ${attempts + 1} failed", e)
            }
            
            attempts++
            if (attempts < MAX_RETRY_ATTEMPTS) {
                delay(RETRY_DELAY_MS)
            }
        }
        
        return false
    }

    /**
     * Queue a log entry for later transmission
     */
    private fun queueLog(context: Context, logEntry: AuditLogEntry) {
        try {
            val prefs = getPrefs(context)
            val queuedLogs = getQueuedLogs(context).toMutableList()
            
            // Add new log
            queuedLogs.add(logEntry)
            
            // Limit queue size (FIFO)
            while (queuedLogs.size > MAX_QUEUE_SIZE) {
                queuedLogs.removeAt(0)
                Log.w(TAG, "Audit log queue full, removing oldest entry")
            }
            
            // Save to preferences
            val json = gson.toJson(queuedLogs)
            prefs.edit().putString(KEY_QUEUED_LOGS, json).apply()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to queue audit log", e)
        }
    }

    /**
     * Get all queued log entries
     */
    private fun getQueuedLogs(context: Context): List<AuditLogEntry> {
        return try {
            val prefs = getPrefs(context)
            val json = prefs.getString(KEY_QUEUED_LOGS, null) ?: return emptyList()
            val type = object : TypeToken<List<AuditLogEntry>>() {}.type
            gson.fromJson(json, type) ?: emptyList()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load queued logs", e)
            emptyList()
        }
    }

    /**
     * Remove successfully sent logs from queue
     */
    private fun removeFromQueue(context: Context, sentLogs: List<AuditLogEntry>) {
        try {
            val prefs = getPrefs(context)
            val queuedLogs = getQueuedLogs(context).toMutableList()
            queuedLogs.removeAll(sentLogs)
            
            val json = gson.toJson(queuedLogs)
            prefs.edit().putString(KEY_QUEUED_LOGS, json).apply()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to remove logs from queue", e)
        }
    }

    /**
     * Get shared preferences for audit logs
     */
    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    /**
     * Get count of queued logs
     */
    fun getQueuedLogCount(context: Context): Int {
        return getQueuedLogs(context).size
    }

    /**
     * Clear all queued logs (for testing/debugging)
     */
    fun clearQueue(context: Context) {
        getPrefs(context).edit().remove(KEY_QUEUED_LOGS).apply()
        Log.i(TAG, "Audit log queue cleared")
    }

    /**
     * Convenience method for logging events (shorthand for logEvent)
     */
    fun log(context: Context, eventType: String, eventData: Map<String, String> = emptyMap()) {
        val imei = android.provider.Settings.Secure.getString(
            context.contentResolver,
            android.provider.Settings.Secure.ANDROID_ID
        )
        logEvent(context, imei, eventType, eventData)
    }
}
