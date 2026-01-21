package com.mederpay.enforcera.legacy

import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.util.Log

/**
 * OverlayManager handles centralized overlay state management and enforcement.
 * Implements version-specific overlay strategies (Android 12 fallback, Android 14+ hardened).
 */
object OverlayManager {
    private const val TAG = "OverlayManager"
    private const val PREFS_NAME = "overlay_state"
    private const val KEY_OVERLAY_ACTIVE = "overlay_active"
    private const val KEY_OVERLAY_REASON = "overlay_reason"
    private const val KEY_OVERLAY_MESSAGE = "overlay_message"
    private const val KEY_OVERLAY_TYPE = "overlay_type"

    enum class OverlayType {
        DEVICE_ADMIN_DISABLED,
        COMPANION_MISSING,
        COMPANION_DISABLED,
        COMPANION_TAMPERED,
        PAYMENT_OVERDUE,
        SETTLEMENT_DUE,
        DEVICE_LOCKED
    }

    /**
     * Show enforcement overlay with version-specific implementation
     */
    fun showOverlay(
        context: Context,
        type: OverlayType,
        reason: String,
        message: String,
        data: Map<String, String> = emptyMap()
    ) {
        Log.i(TAG, "Showing overlay: $type - $reason")
        
        // Check if overlay permission is granted
        if (!canDrawOverlays(context)) {
            Log.w(TAG, "Overlay permission not granted - requesting")
            requestOverlayPermission(context)
            // Still show full-screen activity as fallback
        }

        // Store overlay state
        saveOverlayState(context, type, reason, message)

        // Apply version-specific overlay strategy
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ (API 33+) - Hardened overlay
            showHardenedOverlay(context, type, reason, message, data)
        } else {
            // Android 12 (API 31-32) - Fallback overlay
            showFallbackOverlay(context, type, reason, message, data)
        }

        // Log enforcement action
        logOverlayEvent(context, "overlay_shown", type.name, reason)
    }

    /**
     * Dismiss overlay if conditions are met
     */
    fun dismissOverlay(context: Context, type: OverlayType) {
        Log.i(TAG, "Dismissing overlay: $type")
        
        clearOverlayState(context, type)
        logOverlayEvent(context, "overlay_dismissed", type.name, "Conditions resolved")
        
        // Send broadcast to OverlayActivity to finish
        val intent = Intent("com.mederpay.enforcera.DISMISS_OVERLAY").apply {
            putExtra("overlay_type", type.name)
        }
        context.sendBroadcast(intent)
    }

    /**
     * Check if overlay is currently active
     */
    fun isOverlayActive(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_OVERLAY_ACTIVE, false)
    }

    /**
     * Get current overlay state
     */
    fun getOverlayState(context: Context): OverlayState? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_OVERLAY_ACTIVE, false)) {
            return null
        }

        val typeString = prefs.getString(KEY_OVERLAY_TYPE, null) ?: return null
        val type = try {
            OverlayType.valueOf(typeString)
        } catch (e: IllegalArgumentException) {
            return null
        }

        return OverlayState(
            type = type,
            reason = prefs.getString(KEY_OVERLAY_REASON, "") ?: "",
            message = prefs.getString(KEY_OVERLAY_MESSAGE, "") ?: ""
        )
    }

    /**
     * Android 13+ (API 33+) hardened overlay implementation
     */
    private fun showHardenedOverlay(
        context: Context,
        type: OverlayType,
        reason: String,
        message: String,
        data: Map<String, String>
    ) {
        Log.d(TAG, "Using hardened overlay strategy (Android 13+)")
        
        // Use full-screen activity with enhanced restrictions
        val intent = Intent(context, OverlayActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or 
                    Intent.FLAG_ACTIVITY_CLEAR_TASK or
                    Intent.FLAG_ACTIVITY_NO_HISTORY or
                    Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS
            putExtra("overlay_type", type.name)
            putExtra("reason", reason)
            putExtra("message", message)
            putExtra("hardened", true)
            data.forEach { (key, value) ->
                putExtra(key, value)
            }
        }
        context.startActivity(intent)
    }

    /**
     * Android 12 (API 31-32) fallback overlay implementation
     */
    private fun showFallbackOverlay(
        context: Context,
        type: OverlayType,
        reason: String,
        message: String,
        data: Map<String, String>
    ) {
        Log.d(TAG, "Using fallback overlay strategy (Android 12)")
        
        // Use full-screen activity with standard restrictions
        val intent = Intent(context, OverlayActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("overlay_type", type.name)
            putExtra("reason", reason)
            putExtra("message", message)
            putExtra("hardened", false)
            data.forEach { (key, value) ->
                putExtra(key, value)
            }
        }
        context.startActivity(intent)
    }

    /**
     * Check if app can draw overlays
     */
    private fun canDrawOverlays(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(context)
        } else {
            true
        }
    }

    /**
     * Request overlay permission
     */
    private fun requestOverlayPermission(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                android.net.Uri.parse("package:${context.packageName}")
            ).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            try {
                context.startActivity(intent)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to request overlay permission", e)
            }
        }
    }

    /**
     * Save overlay state to preferences
     */
    private fun saveOverlayState(
        context: Context,
        type: OverlayType,
        reason: String,
        message: String
    ) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().apply {
            putBoolean(KEY_OVERLAY_ACTIVE, true)
            putString(KEY_OVERLAY_TYPE, type.name)
            putString(KEY_OVERLAY_REASON, reason)
            putString(KEY_OVERLAY_MESSAGE, message)
            apply()
        }
    }

    /**
     * Clear overlay state from preferences
     */
    private fun clearOverlayState(context: Context, type: OverlayType) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val currentType = prefs.getString(KEY_OVERLAY_TYPE, null)
        
        // Only clear if it matches the current overlay type
        if (currentType == type.name) {
            prefs.edit().apply {
                remove(KEY_OVERLAY_ACTIVE)
                remove(KEY_OVERLAY_TYPE)
                remove(KEY_OVERLAY_REASON)
                remove(KEY_OVERLAY_MESSAGE)
                apply()
            }
        }
    }

    /**
     * Log overlay event for audit trail
     */
    private fun logOverlayEvent(
        context: Context,
        event: String,
        overlayType: String,
        reason: String
    ) {
        Log.i(TAG, "Overlay event: $event, type: $overlayType, reason: $reason")
        // TODO: Send to backend audit API
    }
}

/**
 * Data class representing current overlay state
 */
data class OverlayState(
    val type: OverlayManager.OverlayType,
    val reason: String,
    val message: String
)
