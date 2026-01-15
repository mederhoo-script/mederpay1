package com.mederpay.enforcera

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * PackageChangeReceiver monitors package add/remove/replace events
 * to detect when the companion app is installed, removed, or updated.
 */
class PackageChangeReceiver : BroadcastReceiver() {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val COMPANION_PACKAGE = "com.mederpay.enforcerb"
    private val TAG = "PackageChangeReceiver"

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        val packageName = intent.data?.schemeSpecificPart

        Log.d(TAG, "Package event: $action for package: $packageName")

        // Only monitor companion app package events
        if (packageName != COMPANION_PACKAGE) {
            return
        }

        when (action) {
            Intent.ACTION_PACKAGE_ADDED -> {
                Log.i(TAG, "Companion app installed: $packageName")
                handleCompanionInstalled(context)
            }
            Intent.ACTION_PACKAGE_REMOVED -> {
                Log.w(TAG, "Companion app removed: $packageName - TRIGGERING ENFORCEMENT")
                handleCompanionRemoved(context)
            }
            Intent.ACTION_PACKAGE_REPLACED -> {
                Log.i(TAG, "Companion app updated: $packageName")
                handleCompanionReplaced(context)
            }
        }
    }

    private fun handleCompanionInstalled(context: Context) {
        // Verify installation and signature
        scope.launch {
            if (RecoveryInstaller.verifyPostInstallation(context)) {
                Log.i(TAG, "Companion app verification passed")
                // Log event to backend
                logAuditEvent(context, "companion_installed")
            } else {
                Log.w(TAG, "Companion app verification failed")
                OverlayManager.showOverlay(
                    context,
                    OverlayManager.OverlayType.COMPANION_TAMPERED,
                    "Companion Installation Failed",
                    "The companion app installation could not be verified."
                )
            }
        }
    }

    private fun handleCompanionRemoved(context: Context) {
        // Immediately show enforcement overlay
        OverlayManager.showOverlay(
            context,
            OverlayManager.OverlayType.COMPANION_MISSING,
            "Security App Removed",
            "Required security companion app has been removed. System will restore it."
        )
        
        // Log critical event to backend
        logAuditEvent(context, "companion_removed")
        
        // Trigger recovery
        scope.launch {
            val success = RecoveryInstaller.triggerRecovery(context)
            if (success) {
                Log.i(TAG, "Recovery triggered successfully")
            } else {
                Log.e(TAG, "Recovery trigger failed")
            }
        }
    }

    private fun handleCompanionReplaced(context: Context) {
        // Verify that the replacement is valid
        scope.launch {
            if (!RecoveryInstaller.verifyPostInstallation(context)) {
                Log.w(TAG, "Companion app replacement verification failed")
                OverlayManager.showOverlay(
                    context,
                    OverlayManager.OverlayType.COMPANION_TAMPERED,
                    "Invalid App Update",
                    "The companion app update is not authorized."
                )
                logAuditEvent(context, "companion_tamper_detected")
            } else {
                Log.i(TAG, "Companion app update verified")
                logAuditEvent(context, "companion_updated")
            }
        }
    }

    private fun logAuditEvent(context: Context, event: String) {
        scope.launch(Dispatchers.IO) {
            try {
                // Send audit event to backend
                Log.i(TAG, "Logging audit event: $event")
                // TODO: Implement backend API call
            } catch (e: Exception) {
                Log.e(TAG, "Failed to log audit event", e)
            }
        }
    }
}
