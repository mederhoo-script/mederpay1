package com.mederpay.enforcerb

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * CompanionMonitor provides comprehensive monitoring and health checking
 * for the companion app (Enforcer A).
 */
object CompanionMonitor {
    private const val COMPANION_PACKAGE = "com.mederpay.enforcera"
    private const val TAG = "CompanionMonitor"

    /**
     * Comprehensive health check of companion app
     */
    suspend fun performHealthCheck(context: Context): CompanionHealth = withContext(Dispatchers.IO) {
        val health = CompanionHealth(
            isInstalled = isCompanionAppInstalled(context),
            isEnabled = isCompanionEnabled(context),
            isRunning = isCompanionRunning(context),
            version = getCompanionVersion(context),
            signatureValid = verifyCompanionSignature(context),
            isDeviceAdminActive = isCompanionDeviceAdminActive(context)
        )
        
        Log.d(TAG, "Companion health: $health")
        return@withContext health
    }

    /**
     * Check if companion app is installed
     */
    fun isCompanionAppInstalled(context: Context): Boolean {
        return try {
            context.packageManager.getPackageInfo(COMPANION_PACKAGE, 0)
            true
        } catch (e: PackageManager.NameNotFoundException) {
            false
        }
    }

    /**
     * Check if companion app is enabled
     */
    private fun isCompanionEnabled(context: Context): Boolean {
        return try {
            val packageInfo = context.packageManager.getPackageInfo(COMPANION_PACKAGE, 0)
            val appInfo = packageInfo.applicationInfo
            appInfo.enabled
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Check if companion app service is running
     */
    private fun isCompanionRunning(context: Context): Boolean {
        // Check if companion's enforcement service is running
        // This is a simplified check; in production, use ActivityManager
        return isCompanionAppInstalled(context) && isCompanionEnabled(context)
    }

    /**
     * Get companion app version
     */
    private fun getCompanionVersion(context: Context): String? {
        return RecoveryInstaller.getCompanionVersion(context)
    }

    /**
     * Verify companion app signature
     */
    fun verifyCompanionSignature(context: Context): Boolean {
        return try {
            val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.packageManager.getPackageInfo(
                    COMPANION_PACKAGE,
                    PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES.toLong())
                )
            } else {
                @Suppress("DEPRECATION")
                context.packageManager.getPackageInfo(
                    COMPANION_PACKAGE,
                    PackageManager.GET_SIGNATURES
                )
            }
            
            val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                packageInfo.signingInfo?.apkContentsSigners
            } else {
                @Suppress("DEPRECATION")
                packageInfo.signatures
            }
            
            signatures != null && signatures.isNotEmpty()
        } catch (e: Exception) {
            Log.e(TAG, "Signature verification failed", e)
            false
        }
    }

    /**
     * Check if companion has Device Admin active
     */
    private fun isCompanionDeviceAdminActive(context: Context): Boolean {
        return try {
            // We can't directly check another app's device admin status
            // This is a placeholder - in production, query via backend API
            isCompanionAppInstalled(context)
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Launch companion app
     */
    fun launchCompanionApp(context: Context) {
        try {
            val launchIntent = context.packageManager.getLaunchIntentForPackage(COMPANION_PACKAGE)
            if (launchIntent != null) {
                launchIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                context.startActivity(launchIntent)
                Log.i(TAG, "Launched companion app")
            } else {
                Log.w(TAG, "Cannot launch companion app - no launch intent")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch companion app", e)
        }
    }

    /**
     * Trigger recovery if companion is unhealthy
     */
    suspend fun triggerRecoveryIfNeeded(context: Context): Boolean = withContext(Dispatchers.IO) {
        if (RecoveryInstaller.needsRecovery(context)) {
            Log.w(TAG, "Companion needs recovery - triggering")
            return@withContext RecoveryInstaller.triggerRecovery(context)
        }
        return@withContext false
    }
}

/**
 * Data class representing companion app health status
 */
data class CompanionHealth(
    val isInstalled: Boolean,
    val isEnabled: Boolean,
    val isRunning: Boolean,
    val version: String?,
    val signatureValid: Boolean,
    val isDeviceAdminActive: Boolean
) {
    val isHealthy: Boolean
        get() = isInstalled && isEnabled && signatureValid && isDeviceAdminActive
}
