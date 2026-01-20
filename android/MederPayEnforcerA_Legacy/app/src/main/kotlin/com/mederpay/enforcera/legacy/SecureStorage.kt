package com.mederpay.enforcera.legacy

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * SecureStorage provides encrypted storage for sensitive data
 * Uses Android Keystore for key management on Android 12+
 */
object SecureStorage {
    private const val TAG = "SecureStorage"
    private const val PREFS_NAME = "secure_storage"
    private const val KEYSTORE_ALIAS = "mederpay_enforcer_key"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val KEY_SIZE = 256
    private const val GCM_TAG_LENGTH = 128
    
    /**
     * Store encrypted value
     */
    fun putString(context: Context, key: String, value: String): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                // Use Keystore encryption on Android 6+
                val encrypted = encrypt(value)
                getPrefs(context).edit().putString(key, encrypted).apply()
                true
            } else {
                // Fallback: basic obfuscation for older devices
                val encoded = Base64.encodeToString(value.toByteArray(), Base64.DEFAULT)
                getPrefs(context).edit().putString(key, encoded).apply()
                true
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to store encrypted value for key: $key", e)
            false
        }
    }
    
    /**
     * Retrieve and decrypt value
     */
    fun getString(context: Context, key: String, defaultValue: String? = null): String? {
        return try {
            val encrypted = getPrefs(context).getString(key, null) ?: return defaultValue
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                // Decrypt using Keystore
                decrypt(encrypted)
            } else {
                // Fallback: decode basic obfuscation
                String(Base64.decode(encrypted, Base64.DEFAULT))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to retrieve encrypted value for key: $key", e)
            defaultValue
        }
    }
    
    /**
     * Remove encrypted value
     */
    fun remove(context: Context, key: String) {
        getPrefs(context).edit().remove(key).apply()
    }
    
    /**
     * Clear all encrypted storage
     */
    fun clear(context: Context) {
        getPrefs(context).edit().clear().apply()
    }
    
    /**
     * Encrypt string using Android Keystore
     */
    private fun encrypt(plaintext: String): String {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return Base64.encodeToString(plaintext.toByteArray(), Base64.DEFAULT)
        }
        
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        
        val iv = cipher.iv
        val encrypted = cipher.doFinal(plaintext.toByteArray())
        
        // Combine IV + encrypted data
        val combined = iv + encrypted
        return Base64.encodeToString(combined, Base64.DEFAULT)
    }
    
    /**
     * Decrypt string using Android Keystore
     */
    private fun decrypt(ciphertext: String): String {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return String(Base64.decode(ciphertext, Base64.DEFAULT))
        }
        
        val combined = Base64.decode(ciphertext, Base64.DEFAULT)
        
        // Extract IV (first 12 bytes for GCM)
        val iv = combined.copyOfRange(0, 12)
        val encrypted = combined.copyOfRange(12, combined.size)
        
        val cipher = Cipher.getInstance(TRANSFORMATION)
        val spec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), spec)
        
        val decrypted = cipher.doFinal(encrypted)
        return String(decrypted)
    }
    
    /**
     * Get or create encryption key in Android Keystore
     */
    private fun getOrCreateKey(): SecretKey {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            throw IllegalStateException("Keystore encryption requires Android M+")
        }
        
        val keyStore = KeyStore.getInstance("AndroidKeyStore")
        keyStore.load(null)
        
        // Check if key exists
        if (keyStore.containsAlias(KEYSTORE_ALIAS)) {
            return keyStore.getKey(KEYSTORE_ALIAS, null) as SecretKey
        }
        
        // Generate new key
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        )
        
        val spec = KeyGenParameterSpec.Builder(
            KEYSTORE_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(KEY_SIZE)
            .setUserAuthenticationRequired(false)
            .build()
        
        keyGenerator.init(spec)
        return keyGenerator.generateKey()
    }
    
    /**
     * Get SharedPreferences instance
     */
    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }
    
    /**
     * Store companion signature hash securely
     */
    fun storeCompanionSignatureHash(context: Context, hash: String): Boolean {
        return putString(context, "companion_signature_hash", hash)
    }
    
    /**
     * Retrieve companion signature hash
     */
    fun getCompanionSignatureHash(context: Context): String? {
        return getString(context, "companion_signature_hash")
    }
    
    /**
     * Store API authentication token
     */
    fun storeApiToken(context: Context, token: String): Boolean {
        return putString(context, "api_token", token)
    }
    
    /**
     * Retrieve API authentication token
     */
    fun getApiToken(context: Context): String? {
        return getString(context, "api_token")
    }
}
