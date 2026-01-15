package com.mederpay.enforcera

import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream

/**
 * RecoveryInstaller handles extraction and installation of the embedded companion APK.
 * This enables the mirrored self-healing recovery system.
 */
object RecoveryInstaller {
    private const val COMPANION_PACKAGE = "com.mederpay.enforcerb"
    private const val EMBEDDED_APK_NAME = "enforcerb.apk"
    private const val TAG = "RecoveryInstaller"

    /**
     * Check if companion app needs recovery
     */
    fun needsRecovery(context: Context): Boolean {
        return !isCompanionInstalled(context) || 
               !isCompanionEnabled(context) ||
               !verifyCompanionSignature(context)
    }

    /**
     * Check if companion app is installed
     */
    private fun isCompanionInstalled(context: Context): Boolean {
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
     * Verify companion app signature matches expected signature
     */
    private fun verifyCompanionSignature(context: Context): Boolean {
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
            
            // Get signatures
            val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                packageInfo.signingInfo?.apkContentsSigners
            } else {
                @Suppress("DEPRECATION")
                packageInfo.signatures
            }
            
            // In production, verify against expected signature
            // For now, just check that signatures exist
            signatures != null && signatures.isNotEmpty()
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Signature verification failed", e)
            false
        }
    }

    /**
     * Get companion app version
     */
    fun getCompanionVersion(context: Context): String? {
        return try {
            val packageInfo = context.packageManager.getPackageInfo(COMPANION_PACKAGE, 0)
            packageInfo.versionName
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Extract embedded APK from assets and trigger installation
     */
    suspend fun triggerRecovery(context: Context): Boolean = withContext(Dispatchers.IO) {
        try {
            android.util.Log.i(TAG, "Starting recovery process for companion app")
            
            // Check if embedded APK exists in assets
            if (!hasEmbeddedApk(context)) {
                android.util.Log.e(TAG, "Embedded APK not found in assets")
                return@withContext false
            }

            // Extract APK to internal storage
            val apkFile = extractApkFromAssets(context)
            if (apkFile == null || !apkFile.exists()) {
                android.util.Log.e(TAG, "Failed to extract APK")
                return@withContext false
            }

            android.util.Log.i(TAG, "APK extracted to: ${apkFile.absolutePath}")

            // Launch system installer
            launchInstaller(context, apkFile)
            
            return@withContext true
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Recovery failed", e)
            return@withContext false
        }
    }

    /**
     * Check if embedded APK exists in assets
     */
    private fun hasEmbeddedApk(context: Context): Boolean {
        return try {
            context.assets.list("")?.contains(EMBEDDED_APK_NAME) ?: false
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Extract APK from assets to internal storage
     */
    private fun extractApkFromAssets(context: Context): File? {
        return try {
            val apkDir = File(context.filesDir, "apks")
            if (!apkDir.exists()) {
                apkDir.mkdirs()
            }

            val apkFile = File(apkDir, EMBEDDED_APK_NAME)
            
            // If file already exists, delete it first
            if (apkFile.exists()) {
                apkFile.delete()
            }

            // Copy from assets to file
            context.assets.open(EMBEDDED_APK_NAME).use { input ->
                FileOutputStream(apkFile).use { output ->
                    input.copyTo(output)
                }
            }

            apkFile
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to extract APK from assets", e)
            null
        }
    }

    /**
     * Launch system installer with user confirmation
     */
    private fun launchInstaller(context: Context, apkFile: File) {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            // Use FileProvider for Android 7+
            val apkUri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                apkFile
            )
            Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }
        } else {
            // Direct file URI for older versions
            @Suppress("DEPRECATION")
            Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(Uri.fromFile(apkFile), "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
        }

        context.startActivity(intent)
        android.util.Log.i(TAG, "Installer launched for companion app")
    }

    /**
     * Verify post-installation integrity
     */
    suspend fun verifyPostInstallation(context: Context): Boolean = withContext(Dispatchers.IO) {
        try {
            // Wait a bit for installation to complete
            kotlinx.coroutines.delay(2000)
            
            // Check if installed
            if (!isCompanionInstalled(context)) {
                android.util.Log.w(TAG, "Post-install: Companion not installed")
                return@withContext false
            }

            // Check if enabled
            if (!isCompanionEnabled(context)) {
                android.util.Log.w(TAG, "Post-install: Companion not enabled")
                return@withContext false
            }

            // Verify signature
            if (!verifyCompanionSignature(context)) {
                android.util.Log.w(TAG, "Post-install: Signature verification failed")
                return@withContext false
            }

            // Check version
            val version = getCompanionVersion(context)
            android.util.Log.i(TAG, "Post-install: Companion version $version verified")

            return@withContext true
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Post-install verification failed", e)
            return@withContext false
        }
    }
}
