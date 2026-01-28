# Android Apps - Production Deployment Security Checklist

## 🔴 CRITICAL: Must Complete Before Production

### 1. API Endpoint Configuration
**Status**: ⚠️ REQUIRES CONFIGURATION

Current configuration uses HTTP for development:
```kotlin
buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:8000/api\"")
```

**Required Actions**:
- [ ] Change API_BASE_URL to HTTPS production URL in both apps
  - File: `MederPayEnforcerA/app/build.gradle.kts` (line 17)
  - File: `MederPayEnforcerB/app/build.gradle.kts` (line 17)
  - Example: `"https://api.mederpay.com/api"`

- [ ] Update network_security_config.xml with production domain
  - File: `MederPayEnforcerA/app/src/main/res/xml/network_security_config.xml`
  - File: `MederPayEnforcerB/app/src/main/res/xml/network_security_config.xml`
  - Uncomment the production domain-config section
  - Replace `api.mederpay.com` with your actual domain
  
- [ ] Configure certificate pinning
  - Extract SSL certificate SHA-256 pins from your production server:
    ```bash
    openssl s_client -connect api.mederpay.com:443 -servername api.mederpay.com </dev/null 2>/dev/null | \
    openssl x509 -pubkey -noout | \
    openssl pkey -pubin -outform der | \
    openssl dgst -sha256 -binary | \
    openssl enc -base64
    ```
  - Add both primary and backup certificate pins to network_security_config.xml

- [ ] Remove cleartext localhost exception from network_security_config.xml (production only)

### 2. APK Signature Verification
**Status**: 🔴 CRITICAL - Placeholders Must Be Replaced

Both apps currently have placeholder signatures that disable security checks:
```kotlin
// App A: SignatureVerifier.kt
private const val EXPECTED_APP_B_SIGNATURE = "PLACEHOLDER_APP_B_SIGNATURE_SHA256"
private const val EXPECTED_APP_B_SIGNATURE_DEBUG = "PLACEHOLDER_APP_B_DEBUG_SIGNATURE"

// App B: SignatureVerifier.kt  
private const val EXPECTED_APP_A_SIGNATURE = "PLACEHOLDER_APP_A_SIGNATURE_SHA256"
private const val EXPECTED_APP_A_SIGNATURE_DEBUG = "PLACEHOLDER_APP_A_DEBUG_SIGNATURE"
```

**Required Actions**:
1. [ ] Build release APKs with release keystore:
   ```bash
   cd android
   ./build-dual-apps.sh release
   ```

2. [ ] Extract actual signatures:
   ```bash
   cd android
   ./extract-signatures.sh
   ```

3. [ ] Update SignatureVerifier.kt files with extracted signatures:
   - `MederPayEnforcerA/app/src/main/kotlin/com/mederpay/enforcera/SignatureVerifier.kt`
   - `MederPayEnforcerB/app/src/main/kotlin/com/mederpay/enforcerb/SignatureVerifier.kt`

4. [ ] Rebuild APKs after updating signatures

5. [ ] Test mutual verification on device before deployment

**Security Impact**: Without real signatures, any app with the same package name will be accepted, completely bypassing dual-app tamper protection.

### 3. Release Build Configuration
**Status**: ✅ CONFIGURED (Verify settings)

ProGuard/R8 obfuscation is enabled:
```kotlin
release {
    isMinifyEnabled = true
    isShrinkResources = true
}
```

**Verification Steps**:
- [ ] Confirm no debuggable flags in release builds
- [ ] Test that release builds have obfuscated code (use jadx or similar)
- [ ] Keep mapping.txt files for crash report deobfuscation
- [ ] Store release keystore securely (not in repository)

### 4. Data Backup Configuration  
**Status**: ✅ SECURED

Sensitive data is now excluded from backups:
- ✅ network_security_config.xml added
- ✅ data_extraction_rules.xml added
- ✅ AndroidManifest.xml updated with security configs

Files protected from backup:
- `secure_storage.xml` (contains encrypted API tokens)
- All databases
- Audit logs

**No action required** - configuration is production-ready.

### 5. Network Security Configuration
**Status**: ✅ CONFIGURED (Requires domain update)

Security features enabled:
- ✅ Base config blocks cleartext traffic
- ✅ Development exception for localhost (must remove in production)
- ⚠️ Certificate pinning template ready (needs production pins)
- ✅ Retrofit timeout configuration added (30 seconds)

**Required Actions**:
- [ ] Update production domain in network_security_config.xml
- [ ] Add actual certificate pins (see section 1)
- [ ] Remove localhost exception for production builds

---

## 🟠 HIGH PRIORITY: Address Before Production

### 6. Encryption for Older Android Versions
**Status**: ⚠️ FALLBACK WEAK

Current implementation uses Base64 encoding (not encryption) for Android < 6.0:
```kotlin
// SecureStorage.kt line 38-42
val encoded = Base64.encodeToString(value.toByteArray(), Base64.DEFAULT)
```

**Options**:
1. **Recommended**: Require Android 6.0+ (API 23) minimum
   - Update minSdk in build.gradle.kts from 31 to 31 (already set correctly)
   - Current minSdk is 31 (Android 12), so this is already handled ✅

2. Alternative: Implement AES encryption for older versions
   - Not needed since minSdk is 31

**No action required** - App already requires Android 12+ (API 31).

### 7. Exception Handling & Logging
**Status**: ✅ FIXED

Replaced all `e.printStackTrace()` calls with proper logging:
```kotlin
android.util.Log.e("EnforcementService", "Error message", e)
```

ProGuard already configured to remove debug logs in release:
```
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}
```

**No further action required**.

### 8. Null Safety in Payment Flow
**Status**: ⚠️ NEEDS REVIEW

Payment overlay code should validate API responses:
```kotlin
// MonnifyPaymentManager.kt
val accountInfo = response.body()
// Add null checks before using accountInfo fields
```

**Recommended Action**:
- [ ] Review MonnifyPaymentManager.kt for null safety
- [ ] Add defensive null checks for all API response fields
- [ ] Test with malformed/empty responses

---

## 🟡 MEDIUM PRIORITY: Code Quality Improvements

### 9. Audit Log Storage
**Status**: ⚠️ CONSIDERATION

Audit logs are queued in SharedPreferences:
```kotlin
// AuditLogger.kt line 18
val prefs = context.getSharedPreferences("audit_queue", Context.MODE_PRIVATE)
```

**Options**:
1. Accept current implementation (logs are ephemeral, uploaded periodically)
2. Use SecureStorage for queued logs (adds overhead)

**Recommendation**: Current implementation is acceptable if logs are uploaded within minutes and don't contain sensitive PII.

### 10. ProGuard Obfuscation Rules
**Status**: ✅ IMPROVED

Updated rules to allow more obfuscation:
- ✅ Removed blanket `-keep class com.mederpay.enforcera.** { *; }`
- ✅ Only keeping essential Android components
- ✅ API data classes protected
- ✅ Critical security classes kept for debugging

**No further action required**.

### 11. Coroutine Scope Management
**Status**: ⚠️ MINOR ISSUE

Object-level coroutine scope in AuditLogger:
```kotlin
private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
```

**Impact**: Low - scope is singleton and used for background work
**Recommendation**: Acceptable for a singleton service, but consider cancelling on app shutdown if needed.

---

## 📋 Pre-Production Testing Checklist

### Security Testing
- [ ] Test with Charles Proxy to verify HTTPS enforcement
- [ ] Verify cleartext HTTP is blocked (should fail to connect)
- [ ] Test certificate pinning (use invalid cert, should reject)
- [ ] Verify companion app signature validation (install fake app with same package name)
- [ ] Test backup exclusion (adb backup, verify secure_storage not included)
- [ ] Verify ProGuard obfuscation (decompile APK, check for obfuscated names)

### Functional Testing  
- [ ] Test on Android 12, 13, 14, and 15 devices
- [ ] Verify foreground service notifications
- [ ] Test boot receiver (restart device, verify service starts)
- [ ] Test Device Admin enforcement (disable, verify overlay shows)
- [ ] Test companion app monitoring (uninstall companion, verify detection)
- [ ] Test payment overlay flow end-to-end
- [ ] Verify audit log upload to backend
- [ ] Test network timeout handling (airplane mode during API call)

### Build Testing
- [ ] Build release APKs with actual release keystore
- [ ] Verify no debuggable flags in AndroidManifest
- [ ] Confirm obfuscated method names in decompiled APK
- [ ] Test APK signature verification between apps
- [ ] Verify no test/debug code in release build

---

## 🔐 Keystore Management

### Release Keystore Security
**CRITICAL**: Store keystore securely, NEVER commit to Git

Required for production:
1. [ ] Generate release keystore (if not already done):
   ```bash
   keytool -genkey -v -keystore mederpay-release.keystore \
     -alias mederpay -keyalg RSA -keysize 2048 -validity 10000
   ```

2. [ ] Configure gradle.properties (add to .gitignore):
   ```properties
   MEDERPAY_RELEASE_STORE_FILE=/path/to/mederpay-release.keystore
   MEDERPAY_RELEASE_STORE_PASSWORD=***
   MEDERPAY_RELEASE_KEY_ALIAS=mederpay
   MEDERPAY_RELEASE_KEY_PASSWORD=***
   ```

3. [ ] Update build.gradle.kts to use keystore for release builds

4. [ ] Backup keystore securely (multiple encrypted locations)

---

## 🚀 Deployment Steps

### Final Pre-Deployment Steps
1. [ ] Complete all items in "CRITICAL" section above
2. [ ] Update API_BASE_URL to production HTTPS endpoint
3. [ ] Configure certificate pinning with production cert pins
4. [ ] Extract and update APK signatures
5. [ ] Build final release APKs with release keystore
6. [ ] Run full security and functional test suite
7. [ ] Test APKs on physical devices (not emulators)
8. [ ] Store mapping.txt files for crash analysis

### Deployment Process
1. [ ] Upload signed APKs to Play Store or distribution platform
2. [ ] Configure backend to accept both App A and App B package names
3. [ ] Deploy both apps simultaneously to customer devices
4. [ ] Monitor crash reports and logs for first 24 hours
5. [ ] Have rollback plan ready

---

## 📊 Security Risk Summary

| Issue | Risk Level | Status | Required Before Production |
|-------|-----------|--------|---------------------------|
| HTTP Cleartext | **CRITICAL** | ⚠️ Dev Config | ✅ YES - Must use HTTPS |
| Placeholder Signatures | **CRITICAL** | 🔴 Not Set | ✅ YES - Security disabled |
| Certificate Pinning | **HIGH** | ⚠️ Template | ✅ YES - Add prod pins |
| Backup Exclusions | **MEDIUM** | ✅ Fixed | ❌ NO - Already secured |
| Exception Handling | **LOW** | ✅ Fixed | ❌ NO - Already fixed |
| Null Safety | **MEDIUM** | ⚠️ Review | ⚠️ RECOMMENDED |
| ProGuard Rules | **LOW** | ✅ Improved | ❌ NO - Already improved |

---

## 📞 Support & Questions

For questions about production deployment:
1. Review this checklist completely
2. Test each security feature
3. Contact security team if issues found

**Last Updated**: 2026-01-28
**Applies To**: MederPayEnforcerA v1.0, MederPayEnforcerB v1.0
