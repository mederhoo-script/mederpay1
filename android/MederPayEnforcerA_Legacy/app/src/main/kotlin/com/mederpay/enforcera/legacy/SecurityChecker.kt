package com.mederpay.enforcera.legacy

import android.content.Context
import android.content.pm.ApplicationInfo
import android.os.Build
import android.util.Log
import java.io.File

/**
 * SecurityChecker - Android 15+ Hardening
 * 
 * Detects rooted devices, debugging, and emulators to prevent security bypasses.
 * Enhanced for Android 15 (API 35) with additional security checks.
 */
object SecurityChecker {
    private const val TAG = "SecurityChecker"
    
    /**
     * Check if device is rooted
     * Android 15+: Additional checks for modern root methods (Magisk, KernelSU)
     */
    fun isDeviceRooted(): Boolean {
        // Check for su binary in common locations
        val rootPaths = listOf(
            "/su/bin/su",
            "/system/xbin/su",
            "/system/bin/su",
            "/sbin/su",
            "/system/sd/xbin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/system/app/Superuser.apk",
            "/system/app/SuperSU.apk",
            // Android 15: Additional Magisk paths
            "/data/adb/magisk",
            "/data/adb/magisk.img",
            "/data/adb/modules",
            // KernelSU (new root method for Android 13+)
            "/data/adb/ksu",
            "/system/xbin/ksu"
        )
        
        val rootDetected = rootPaths.any { path ->
            try {
                File(path).exists()
            } catch (e: Exception) {
                false
            }
        }
        
        if (rootDetected) {
            Log.w(TAG, "Root access detected on device")
        }
        
        return rootDetected
    }
    
    /**
     * Check if app is debuggable
     * Android 15+: Critical security check
     */
    fun isDebuggable(context: Context): Boolean {
        val debuggable = (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        
        if (debuggable) {
            Log.w(TAG, "App is running in debuggable mode")
        }
        
        return debuggable
    }
    
    /**
     * Check if running in emulator
     * Android 15+: Enhanced emulator detection
     */
    fun isEmulator(): Boolean {
        val emulatorDetected = (
            Build.FINGERPRINT.startsWith("generic")
            || Build.FINGERPRINT.startsWith("unknown")
            || Build.MODEL.contains("google_sdk")
            || Build.MODEL.contains("Emulator")
            || Build.MODEL.contains("Android SDK built for x86")
            || Build.MANUFACTURER.contains("Genymotion")
            || (Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic"))
            || "google_sdk" == Build.PRODUCT
            // Android 15: Additional emulator checks
            || Build.HARDWARE.contains("ranchu")
            || Build.HARDWARE.contains("goldfish")
            || Build.PRODUCT.contains("sdk")
            || Build.PRODUCT.contains("emulator")
        )
        
        if (emulatorDetected) {
            Log.w(TAG, "Running in emulator environment")
        }
        
        return emulatorDetected
    }
    
    /**
     * Check for USB debugging (ADB)
     * Android 15+: Detect active debugging connection
     */
    fun isUsbDebuggingEnabled(context: Context): Boolean {
        return try {
            val adbEnabled = android.provider.Settings.Secure.getInt(
                context.contentResolver,
                android.provider.Settings.Global.ADB_ENABLED,
                0
            ) == 1
            
            if (adbEnabled) {
                Log.w(TAG, "USB debugging is enabled")
            }
            
            adbEnabled
        } catch (e: Exception) {
            Log.e(TAG, "Failed to check USB debugging status", e)
            false
        }
    }
    
    /**
     * Check for developer mode enabled
     * Android 15+: Additional security indicator
     */
    fun isDeveloperModeEnabled(context: Context): Boolean {
        return try {
            val devMode = android.provider.Settings.Secure.getInt(
                context.contentResolver,
                android.provider.Settings.Global.DEVELOPMENT_SETTINGS_ENABLED,
                0
            ) == 1
            
            if (devMode) {
                Log.w(TAG, "Developer mode is enabled")
            }
            
            devMode
        } catch (e: Exception) {
            // Setting may not exist on some devices
            false
        }
    }
    
    /**
     * Check if running on Android 15+
     * Useful for applying version-specific security measures
     */
    fun isAndroid15Plus(): Boolean {
        return Build.VERSION.SDK_INT >= 35 // Android 15 = API 35
    }
    
    /**
     * Perform comprehensive security check
     * Android 15+: Full security assessment
     * 
     * @return SecurityReport with all security checks
     */
    fun performSecurityCheck(context: Context): SecurityReport {
        Log.i(TAG, "Performing security check on Android ${Build.VERSION.SDK_INT}")
        
        val report = SecurityReport(
            isRooted = isDeviceRooted(),
            isDebuggable = isDebuggable(context),
            isEmulator = isEmulator(),
            isUsbDebuggingEnabled = isUsbDebuggingEnabled(context),
            isDeveloperModeEnabled = isDeveloperModeEnabled(context),
            androidVersion = Build.VERSION.SDK_INT,
            isAndroid15Plus = isAndroid15Plus()
        )
        
        // Log comprehensive report
        Log.i(TAG, "Security Report: Secure=${report.isSecure}, " +
                "Rooted=${report.isRooted}, " +
                "Debuggable=${report.isDebuggable}, " +
                "Emulator=${report.isEmulator}, " +
                "USB Debug=${report.isUsbDebuggingEnabled}, " +
                "Android ${report.androidVersion}")
        
        return report
    }
    
    /**
     * Get security violation reason for user display
     */
    fun getSecurityViolationReason(report: SecurityReport): String {
        return when {
            report.isRooted -> "Device is rooted. This poses a security risk."
            report.isDebuggable -> "App is running in debug mode. Production builds only."
            report.isEmulator -> "Running in emulator. Physical device required."
            report.isUsbDebuggingEnabled -> "USB debugging is enabled. Please disable in Developer Options."
            else -> "Security check failed. Please contact support."
        }
    }
}

/**
 * Security report data class
 * Android 15+: Comprehensive security status
 */
data class SecurityReport(
    val isRooted: Boolean,
    val isDebuggable: Boolean,
    val isEmulator: Boolean,
    val isUsbDebuggingEnabled: Boolean,
    val isDeveloperModeEnabled: Boolean,
    val androidVersion: Int,
    val isAndroid15Plus: Boolean
) {
    /**
     * Device is secure if all security checks pass
     * Android 15+: Stricter security requirements
     */
    val isSecure: Boolean
        get() = !isRooted && !isDebuggable && !isEmulator
    
    /**
     * Device has security warnings (but may still be allowed)
     * Android 15+: Warning for USB debugging and developer mode
     */
    val hasWarnings: Boolean
        get() = isUsbDebuggingEnabled || isDeveloperModeEnabled
    
    /**
     * Get security level: SECURE, WARNING, or COMPROMISED
     */
    val securityLevel: SecurityLevel
        get() = when {
            !isSecure -> SecurityLevel.COMPROMISED
            hasWarnings -> SecurityLevel.WARNING
            else -> SecurityLevel.SECURE
        }
}

enum class SecurityLevel {
    SECURE,    // All checks pass
    WARNING,   // Device is functional but has security warnings
    COMPROMISED // Device security is compromised, should be blocked
}
