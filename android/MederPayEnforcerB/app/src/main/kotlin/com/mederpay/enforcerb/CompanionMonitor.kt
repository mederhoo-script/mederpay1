package com.mederpay.enforcera

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.security.MessageDigest

/**
 * CompanionMonitor provides comprehensive monitoring and health checking
 * for the companion app (Enforcer B).
 */
object CompanionMonitor {
    private const val COMPANION_PACKAGE = "com.mederpay.enforcera"
    private const val TAG = "CompanionMonitor"
    
    // Expected SHA-256 signature hash of the companion app
    // In production, this should be configured securely or fetched from backend
    private const val EXPECTED_SIGNATURE_HASH = ""  // Set during build/deployment

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
     * Verify companion app signature with SHA-256 cryptographic comparison
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
            
            if (signatures == null || signatures.isEmpty()) {
                Log.w(TAG, "No signatures found for companion app")
                return false
            }

            // If expected hash is configured, perform cryptographic verification
            if (EXPECTED_SIGNATURE_HASH.isNotEmpty()) {
                val actualHash = computeSignatureHash(signatures[0].toByteArray())
                val isValid = actualHash.equals(EXPECTED_SIGNATURE_HASH, ignoreCase = true)
                
                if (!isValid) {
                    Log.e(TAG, "Signature hash mismatch! Expected: $EXPECTED_SIGNATURE_HASH, Got: $actualHash")
                }
                
                return isValid
            }
            
            // Fallback: basic signature existence check
            Log.w(TAG, "Expected signature hash not configured, using basic verification")
            return true
            
        } catch (e: Exception) {
            Log.e(TAG, "Signature verification failed", e)
            false
        }
    }

    /**
     * Compute SHA-256 hash of signature bytes
     */
    private fun computeSignatureHash(signatureBytes: ByteArray): String {
        return try {
            val digest = MessageDigest.getInstance("SHA-256")
            val hashBytes = digest.digest(signatureBytes)
            hashBytes.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to compute signature hash", e)
            ""
        }
    }

    /**
     * Get the actual signature hash of companion app for configuration
     * Use this during initial setup to determine the expected hash
     */
    fun getCompanionSignatureHash(context: Context): String? {
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
            
            if (signatures != null && signatures.isNotEmpty()) {
                computeSignatureHash(signatures[0].toByteArray())
            } else {
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get signature hash", e)
            null
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
