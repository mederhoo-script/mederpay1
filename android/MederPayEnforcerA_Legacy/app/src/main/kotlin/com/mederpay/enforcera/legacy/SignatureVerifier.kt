package com.mederpay.enforcera.legacy

import android.content.Context
import android.content.pm.PackageManager
import android.content.pm.Signature
import android.os.Build
import android.util.Log
import java.security.MessageDigest

/**
 * Signature Verification with Compile-Time Pinning
 * 
 * Replaces trust-on-first-use (TOFU) model with hardcoded signature verification
 * 
 * CRITICAL SECURITY: These signatures MUST be extracted from actual APKs during build
 * See build script: android/extract-signatures.sh
 */
object SignatureVerifier {
    private const val TAG = "SignatureVerifier"
    
    /**
     * Expected SHA-256 signatures for companion apps
     * 
     * IMPORTANT: Replace these with actual signatures from your build APKs
     * 
     * To extract signatures:
     * 1. Build both APKs: ./build-dual-apps.sh release
     * 2. Run: ./extract-signatures.sh
     * 3. Copy output into these constants
     */
    
    // App B (MederPayEnforcerB) expected signature
    private const val EXPECTED_APP_B_SIGNATURE = "PLACEHOLDER_APP_B_SIGNATURE_SHA256"
    
    // Backup signature (for development/testing)
    private const val EXPECTED_APP_B_SIGNATURE_DEBUG = "PLACEHOLDER_APP_B_DEBUG_SIGNATURE"
    
    /**
     * Verify companion app signature against expected pinned signatures
     * 
     * @param context Application context
     * @param packageName Package name to verify
     * @return true if signature matches, false otherwise
     */
    fun verifyCompanionSignature(context: Context, packageName: String): Boolean {
        try {
            val signatures = getPackageSignatures(context, packageName)
            
            if (signatures.isEmpty()) {
                Log.e(TAG, "No signatures found for package: $packageName")
                return false
            }
            
            // Get SHA-256 hash of actual signature
            val actualSignatureHash = signatures.first().let { sig ->
                val digest = MessageDigest.getInstance("SHA-256")
                val hash = digest.digest(sig.toByteArray())
                hash.joinToString("") { "%02x".format(it) }
            }
            
            Log.d(TAG, "Package: $packageName")
            Log.d(TAG, "Actual signature hash: $actualSignatureHash")
            
            // Constant-time comparison against expected signatures
            val matchesRelease = constantTimeCompare(actualSignatureHash, EXPECTED_APP_B_SIGNATURE)
            val matchesDebug = constantTimeCompare(actualSignatureHash, EXPECTED_APP_B_SIGNATURE_DEBUG)
            
            val isValid = matchesRelease || matchesDebug
            
            if (!isValid) {
                Log.e(TAG, "Signature mismatch for $packageName")
                Log.e(TAG, "Expected: $EXPECTED_APP_B_SIGNATURE or $EXPECTED_APP_B_SIGNATURE_DEBUG")
                Log.e(TAG, "Got: $actualSignatureHash")
            }
            
            return isValid
            
        } catch (e: Exception) {
            Log.e(TAG, "Error verifying signature for $packageName", e)
            return false
        }
    }
    
    /**
     * Get package signatures (handles API level differences)
     */
    private fun getPackageSignatures(context: Context, packageName: String): Array<Signature> {
        return try {
            val packageManager = context.packageManager
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                // Android 9+ (API 28+)
                val packageInfo = packageManager.getPackageInfo(
                    packageName,
                    PackageManager.GET_SIGNING_CERTIFICATES
                )
                packageInfo.signingInfo?.let { signingInfo ->
                    if (signingInfo.hasMultipleSigners()) {
                        signingInfo.apkContentsSigners
                    } else {
                        signingInfo.signingCertificateHistory
                    }
                } ?: emptyArray()
            } else {
                // Android 8.1 and below (API 27-)
                @Suppress("DEPRECATION")
                val packageInfo = packageManager.getPackageInfo(
                    packageName,
                    PackageManager.GET_SIGNATURES
                )
                @Suppress("DEPRECATION")
                packageInfo.signatures ?: emptyArray()
            }
        } catch (e: PackageManager.NameNotFoundException) {
            Log.e(TAG, "Package not found: $packageName", e)
            emptyArray()
        }
    }
    
    /**
     * Constant-time string comparison to prevent timing attacks
     * 
     * @param a First string
     * @param b Second string
     * @return true if strings are equal, false otherwise
     */
    private fun constantTimeCompare(a: String, b: String): Boolean {
        if (a.length != b.length) {
            return false
        }
        
        var result = 0
        for (i in a.indices) {
            result = result or (a[i].code xor b[i].code)
        }
        
        return result == 0
    }
    
    /**
     * Generate signature hash for a package (utility for development)
     * Used to extract signatures during build process
     */
    fun generateSignatureHash(context: Context, packageName: String): String? {
        try {
            val signatures = getPackageSignatures(context, packageName)
            if (signatures.isEmpty()) {
                return null
            }
            
            val signature = signatures.first()
            val digest = MessageDigest.getInstance("SHA-256")
            val hash = digest.digest(signature.toByteArray())
            return hash.joinToString("") { "%02x".format(it) }
            
        } catch (e: Exception) {
            Log.e(TAG, "Error generating signature hash", e)
            return null
        }
    }
    
    /**
     * Validation check: Are signatures configured?
     * Returns false if signatures are still placeholders
     */
    fun areSignaturesConfigured(): Boolean {
        return !EXPECTED_APP_B_SIGNATURE.startsWith("PLACEHOLDER") &&
               !EXPECTED_APP_B_SIGNATURE_DEBUG.startsWith("PLACEHOLDER")
    }
}
