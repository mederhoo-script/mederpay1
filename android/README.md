# MederPay Android Enforcement Apps

**Dual-App Mirrored Security Enforcement Architecture**

This directory contains two interdependent Android applications that form a tamper-resistant enforcement system for the MederPay platform.

## 📱 Version Availability

### Standard Version (Android 12+)
**For devices running Android 12 and above (API 31+)**
- MederPayEnforcerA
- MederPayEnforcerB

### Legacy Version (Android 5.0-11)
**For devices running Android 5.0 through 11 (API 21-30)**
- MederPayEnforcerA_Legacy
- MederPayEnforcerB_Legacy

📖 **See [LEGACY_VERSION_README.md](./LEGACY_VERSION_README.md) for legacy version documentation**

---

## 📱 Applications

### App A - MederPay Enforcer A
**Package:** `com.mederpay.enforcera`  
**Role:** Agent Enforcement Application  
**Responsibilities:**
- Weekly payment settlement enforcement
- Backend communication (Django APIs)
- Event logging and audit trail
- User-facing overlays
- Device Admin enforcement
- **Contains:** Embedded signed APK of App B

### App B - MederPay Enforcer B  
**Package:** `com.mederpay.enforcerb`  
**Role:** Security Companion Application  
**Responsibilities:**
- Device Admin enforcement
- Anti-tamper & integrity monitoring
- Continuous App A health monitoring
- Boot-time & runtime recovery enforcement
- Acts as security anchor
- **Contains:** Embedded signed APK of App A

## 🏗️ Architecture

```
┌─────────────────┐                    ┌─────────────────┐
│   App A         │◄──────monitors────►│   App B         │
│  (Enforcer A)   │                    │  (Enforcer B)   │
├─────────────────┤                    ├─────────────────┤
│ Contains:       │                    │ Contains:       │
│ - enforcerb.apk │                    │ - enforcera.apk │
│                 │                    │                 │
│ Detects:        │                    │ Detects:        │
│ - B missing     │                    │ - A missing     │
│ - B disabled    │                    │ - A disabled    │
│ - B tampered    │                    │ - A tampered    │
│                 │                    │                 │
│ Recovery:       │                    │ Recovery:       │
│ - Extract APK   │                    │ - Extract APK   │
│ - Install B     │                    │ - Install A     │
│ - Verify        │                    │ - Verify        │
└─────────────────┘                    └─────────────────┘
        │                                      │
        └──────────Both enforce────────────────┘
                Device Admin Active
                Companion Healthy
                Payment Status
```

## 🎯 Key Features

### ✅ Implemented (Phase 1 - ~65%)

#### Core Security
- ✅ **Mutual Dependency Enforcement** - Neither app functions without the other
- ✅ **Mirrored Self-Healing** - Each app can restore the other automatically
- ✅ **Device Admin Enforcement** - Required for both apps
- ✅ **Signature Verification** - APK integrity checking
- ✅ **Tamper Detection** - Real-time package monitoring
- ✅ **Boot Persistence** - Auto-restart on device boot

#### Monitoring & Enforcement
- ✅ **Comprehensive Health Checks** - Installation, enabled state, signature, version
- ✅ **Package Change Monitoring** - Real-time detection of install/remove/replace
- ✅ **Version-Specific Logic** - Android 12 fallback, Android 13+ hardened
- ✅ **Centralized Overlay Management** - 7 enforcement states
- ✅ **Non-Dismissible Overlays** - Back button blocked
- ✅ **Foreground Services** - Persistent monitoring

### ⚠️ Partially Implemented

- ⚠️ **Overlay Activity** - Basic implementation, needs OverlayManager integration
- ⚠️ **Signature Verification** - Framework ready, needs production hardening
- ⚠️ **Audit Logging** - Local logging only, needs backend integration

### ❌ Not Yet Implemented (Phase 2)

- ❌ **Payment Settlement Enforcement** - App A weekly settlement feature
- ❌ **Monnify Payment Integration** - One-time dynamic payments
- ❌ **OEM-Specific Mitigations** - MIUI, OneUI, Tecno, Infinix
- ❌ **Security Hardening** - Root detection, anti-debugging, emulator detection
- ❌ **Work Manager Integration** - Resilient background scheduling

See [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) for detailed status.

## 🚀 Build Instructions

### Prerequisites

- **Android Studio:** Arctic Fox or later
- **JDK:** 17+
- **Kotlin:** 2.1.0+
- **Gradle:** 8.7+
- **Android SDK:** API 35 (target), API 31 (min)

### Standard Build (No Embedded APKs)

```bash
# Build App A
cd MederPayEnforcerA
./gradlew assembleRelease

# Build App B
cd ../MederPayEnforcerB
./gradlew assembleRelease
```

**Note:** This will NOT include embedded APKs. Apps will have limited recovery capability.

### Dual-App Build (With Embedded APKs) - RECOMMENDED

Use the automated build script:

```bash
cd android

# For release builds
./build-dual-apps.sh release

# For debug builds
./build-dual-apps.sh debug
```

**Build Process:**
1. Clean both projects
2. Build App B (initial, no embedded App A)
3. Embed App B APK into App A assets
4. Build App A (with embedded App B)
5. Embed App A APK into App B assets
6. Rebuild App B (with embedded App A)
7. Rebuild App A (with final App B)

**Output:**
- `MederPayEnforcerA/app/build/outputs/apk/release/app-release.apk`
- `MederPayEnforcerB/app/build/outputs/apk/release/app-release.apk`

### Signing APKs for Release

#### Option 1: Android Studio
1. Build → Generate Signed Bundle/APK
2. Select APK
3. Choose/create keystore
4. Complete signing wizard

#### Option 2: Command Line
```bash
# Sign App A
jarsigner -verbose \
  -keystore /path/to/keystore.jks \
  -storepass YOUR_STORE_PASSWORD \
  -keypass YOUR_KEY_PASSWORD \
  MederPayEnforcerA/app/build/outputs/apk/release/app-release-unsigned.apk \
  key_alias

# Align App A
zipalign -v 4 \
  MederPayEnforcerA/app/build/outputs/apk/release/app-release-unsigned.apk \
  MederPayEnforcerA/app/build/outputs/apk/release/app-release.apk

# Repeat for App B...
```

## 📦 Installation

### Development Testing

```bash
# Install both apps via ADB
adb install -r MederPayEnforcerA/app/build/outputs/apk/release/app-release.apk
adb install -r MederPayEnforcerB/app/build/outputs/apk/release/app-release.apk
```

### Production Deployment

1. **Build with Embedded APKs** (use `build-dual-apps.sh`)
2. **Sign APKs** with release keystore
3. **Distribute APKs** to agents/customers
4. **Install in Order:**
   - Install App B first
   - Install App A second
5. **Activate Device Admin** for both apps
6. **Grant Permissions:**
   - System Alert Window (overlays)
   - Foreground Service
   - Install Packages

## 🧪 Testing

### Manual Test Scenarios

#### 1. Mutual Dependency
```bash
# Test companion missing detection
adb install app-a.apk
# Don't install app-b.apk
# Expected: App A shows "Companion Missing" overlay

adb install app-b.apk
# Expected: Both apps become healthy
```

#### 2. Self-Healing Recovery
```bash
# Install both apps
adb install app-a.apk
adb install app-b.apk

# Remove App B
adb uninstall com.mederpay.enforcerb

# Expected: 
# - App A shows "Security App Removed" overlay
# - App A triggers recovery (APK extraction + installer launch)
# - User sees system installer for App B
```

#### 3. Tamper Detection
```bash
# Install signed apps
adb install app-a-signed.apk
adb install app-b-signed.apk

# Try to replace with unsigned version
adb install app-b-unsigned.apk

# Expected: App A detects signature mismatch and shows "Tampered" overlay
```

#### 4. Device Admin Enforcement
```bash
# In device settings, disable Device Admin for App A
# Expected: Overlay appears immediately with "Enable Device Admin" button
```

#### 5. Boot Persistence
```bash
# Install and activate both apps
adb reboot

# After reboot:
# Expected: Both enforcement services auto-start
adb shell dumpsys activity services | grep -i mederpay
```

### Automated Testing (TODO)

```bash
cd MederPayEnforcerA
./gradlew test              # Unit tests
./gradlew connectedAndroidTest  # Instrumentation tests
```

## 🔧 Configuration

### API Endpoint

Update the API base URL in `app/build.gradle.kts`:

```kotlin
buildConfigField("String", "API_BASE_URL", "\"https://your-backend.com/api\"")
```

**Default:** `http://10.0.2.2:8000/api` (emulator localhost)

### Embedded APK Names

If you need to change embedded APK filenames, update:

**App A:**
- `RecoveryInstaller.kt`: `EMBEDDED_APK_NAME = "enforcerb.apk"`

**App B:**
- `RecoveryInstaller.kt`: `EMBEDDED_APK_NAME = "enforcera.apk"`

## 📝 Permissions

### Required Permissions

Both apps request:

| Permission | Purpose |
|------------|---------|
| `INTERNET` | Backend API communication |
| `FOREGROUND_SERVICE` | Persistent monitoring |
| `FOREGROUND_SERVICE_SPECIAL_USE` | Android 14+ enforcement |
| `RECEIVE_BOOT_COMPLETED` | Auto-start on boot |
| `SYSTEM_ALERT_WINDOW` | Non-dismissible overlays |
| `REQUEST_INSTALL_PACKAGES` | APK installation for recovery |
| `WAKE_LOCK` | Keep service running |

### Runtime Permissions

- **System Alert Window:** Requested automatically by OverlayManager
- **Device Admin:** Requested via MainActivity and enforcement overlays

## 🔐 Security Considerations

### Current Security Measures
- ✅ APK signature verification
- ✅ Package tampering detection
- ✅ Device Admin enforcement
- ✅ Non-dismissible overlays
- ✅ Foreground service protection
- ✅ Boot persistence

### Security Gaps (Phase 2)
- ❌ No encrypted storage
- ❌ No root detection
- ❌ No anti-debugging
- ❌ No emulator detection
- ❌ Code not obfuscated

**⚠️ Production Deployment:** Implement security hardening before deploying to production.

## 📊 Architecture Components

### Core Classes

#### RecoveryInstaller
- APK extraction from assets
- System installer invocation
- Post-installation verification
- Signature validation

#### CompanionMonitor
- Comprehensive health checking
- Installation/enabled state detection
- Signature verification
- Version consistency checking

#### OverlayManager
- Centralized overlay state management
- Version-specific strategies (Android 12 vs 13+)
- 7 enforcement states
- Overlay permission handling

#### EnforcementService
- 5-minute enforcement cycle
- Device Admin monitoring
- Companion health checks
- Backend API integration
- Command execution

#### PackageChangeReceiver
- Real-time package monitoring
- Install/remove/replace detection
- Immediate enforcement on tampering
- Automatic recovery trigger

#### DeviceAdminReceiver
- Device Admin lifecycle events
- Enable/disable callbacks
- Enforcement redirection

#### BootReceiver
- Boot-time auto-start
- Service restart on device boot

## 🔗 Backend Integration

### API Endpoints Used

```
POST /api/enforcement/health-check/
GET  /api/enforcement/status/{imei}/
GET  /api/device-commands/pending/?imei={imei}
POST /api/device-commands/{id}/acknowledge/
POST /api/device-commands/{id}/execute/
```

### Health Check Payload

```json
{
  "imei": "device_android_id",
  "is_device_admin_enabled": true,
  "is_companion_app_installed": true,
  "companion_app_version": "1.0",
  "android_version": "14",
  "app_version": "1.0",
  "battery_level": 85,
  "is_locked": false,
  "lock_reason": null
}
```

## 🐛 Troubleshooting

### App B Not Found Error
**Issue:** App A can't find embedded App B APK  
**Solution:** Rebuild using `build-dual-apps.sh` script

### Signature Verification Failed
**Issue:** Tamper detection triggers incorrectly  
**Solution:** Ensure both APKs are signed with the same keystore

### Overlay Permission Denied
**Issue:** Non-dismissible overlay doesn't appear  
**Solution:** Grant "Display over other apps" permission in settings

### Service Not Restarting After Reboot
**Issue:** Apps don't auto-start after device reboot  
**Solution:** 
1. Check battery optimization settings (exclude both apps)
2. Check autostart permissions (OEM-specific)

### Recovery Installer Not Working
**Issue:** APK extraction fails  
**Solution:** 
1. Verify embedded APK exists in assets
2. Check FileProvider configuration
3. Grant "Install from Unknown Sources" permission

## 📚 Additional Documentation

- [`LEGACY_VERSION_README.md`](./LEGACY_VERSION_README.md) - **Legacy version (Android 5.0-11)**
- [`LEGACY_IMPLEMENTATION_SUMMARY.md`](./LEGACY_IMPLEMENTATION_SUMMARY.md) - Legacy version technical details
- [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) - Detailed implementation status
- [`BUILD_APK_INSTRUCTIONS.md`](./BUILD_APK_INSTRUCTIONS.md) - Build instructions for both versions
- [`../README.md`](../README.md) - Overall project documentation
- [`../DEPLOYMENT.md`](../DEPLOYMENT.md) - Production deployment guide
- [`../backend/README.md`](../backend/README.md) - Backend API documentation

## 🔄 Legacy Version (Android 5.0-11)

For devices running Android versions below 12, a legacy version is available with full feature parity:

### Key Differences
- **Package Names:** `com.mederpay.enforcer[a|b].legacy`
- **Min SDK:** 21 (Android 5.0) instead of 31 (Android 12)
- **App Names:** Include "(Legacy)" suffix
- **Compatible:** All features work on older Android versions

### Build Legacy Version
```bash
cd android
./build-dual-apps-legacy.sh release
```

### Documentation
See [LEGACY_VERSION_README.md](./LEGACY_VERSION_README.md) for complete documentation including:
- Build instructions
- Installation guide
- Testing procedures
- OEM-specific configurations
- Compatibility matrix

Both standard and legacy versions can coexist on Android 12+ devices for testing purposes.

## 🤝 Contributing

For contributions to the Android apps:

1. Fork the repository
2. Create a feature branch
3. Make changes following Kotlin conventions
4. Test on physical devices (Android 12, 13, 14)
5. Update documentation
6. Submit pull request

## 📄 License

Proprietary - All rights reserved

## 👥 Support

- **GitHub Issues:** [mederhoo-script/mederpay1](https://github.com/mederhoo-script/mederpay1/issues)
- **Email:** support@mederpay.com

---

**Last Updated:** January 15, 2026  
**Version:** 1.0.0  
**Status:** Phase 1 Implementation (~65% Complete)
