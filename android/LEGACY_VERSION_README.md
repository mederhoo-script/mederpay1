# MederPay Android Enforcement Apps - Legacy Version

**For Android 5.0 - 11 (API 21-30)**

This directory contains legacy versions of the MederPay enforcement apps designed for devices running Android 5.0 (Lollipop) through Android 11, which do not meet the minimum API 31 requirement of the standard version.

## 📱 Applications

### App A Legacy - MederPay Enforcer A (Legacy)
**Package:** `com.mederpay.enforcera.legacy`  
**Min SDK:** 21 (Android 5.0)  
**Target SDK:** 35 (Android 15)  
**Version:** 1.0-legacy

### App B Legacy - MederPay Enforcer B (Legacy)
**Package:** `com.mederpay.enforcerb.legacy`  
**Min SDK:** 21 (Android 5.0)  
**Target SDK:** 35 (Android 15)  
**Version:** 1.0-legacy

## 🔄 Differences from Standard Version

| Feature | Standard Version (API 31+) | Legacy Version (API 21+) |
|---------|---------------------------|--------------------------|
| **Package Names** | `com.mederpay.enforcer[a\|b]` | `com.mederpay.enforcer[a\|b].legacy` |
| **Min Android** | 12 (API 31) | 5.0 (API 21) |
| **App Name** | "MederPay Enforcer A/B" | "MederPay Enforcer A/B (Legacy)" |
| **Foreground Service Type** | Enforced on Android 14+ | Gracefully ignored on older versions |
| **Package Queries** | Uses `<queries>` element | Ignored on Android < 11, uses fallback |
| **Full-Screen Intent** | Required permission | Gracefully ignored on older versions |

## ✅ Full Feature Compatibility

All core features work identically on both versions:
- ✅ **Mutual Dependency Enforcement** - Both apps monitor each other
- ✅ **Self-Healing Recovery** - APK extraction and reinstallation
- ✅ **Device Admin Enforcement** - Required for both apps
- ✅ **Signature Verification** - APK integrity checking with fallbacks
- ✅ **Tamper Detection** - Real-time package monitoring
- ✅ **Boot Persistence** - Auto-restart on device boot
- ✅ **Non-Dismissible Overlays** - Enforcement UI
- ✅ **Backend Communication** - Django API integration
- ✅ **Audit Logging** - Event tracking

## 🏗️ Build Instructions

### Prerequisites

- **Android Studio:** Arctic Fox or later
- **JDK:** 17+
- **Kotlin:** 2.1.0+
- **Gradle:** 8.7+
- **Android SDK:** API 35 (compile), API 21 (min)

### Automated Build (Recommended)

```bash
cd /home/runner/work/mederpay1/mederpay1/android

# For debug builds
./build-dual-apps-legacy.sh debug

# For release builds
./build-dual-apps-legacy.sh release
```

This script performs the same 7-step circular build process as the standard version:
1. Clean both projects
2. Build App B Legacy (initial)
3. Embed App B into App A assets
4. Build App A Legacy (with embedded App B)
5. Embed App A into App B assets
6. Rebuild App B Legacy (with embedded App A)
7. Rebuild App A Legacy (with final App B)

### Manual Build

```bash
# Build App B Legacy (initial)
cd MederPayEnforcerB_Legacy
./gradlew clean assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk \
   ../MederPayEnforcerA_Legacy/app/src/main/assets/enforcerb.apk

# Build App A Legacy (with embedded App B)
cd ../MederPayEnforcerA_Legacy
./gradlew clean assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk \
   ../MederPayEnforcerB_Legacy/app/src/main/assets/enforcera.apk

# Rebuild App B Legacy (with embedded App A)
cd ../MederPayEnforcerB_Legacy
./gradlew clean assembleDebug

# Update App A Legacy with final App B
cp app/build/outputs/apk/debug/app-debug.apk \
   ../MederPayEnforcerA_Legacy/app/src/main/assets/enforcerb.apk
cd ../MederPayEnforcerA_Legacy
./gradlew clean assembleDebug
```

### Output Locations

After successful build:
```
MederPayEnforcerA_Legacy/app/build/outputs/apk/debug/app-debug.apk
MederPayEnforcerB_Legacy/app/build/outputs/apk/debug/app-debug.apk
```

For release builds:
```
MederPayEnforcerA_Legacy/app/build/outputs/apk/release/app-release.apk
MederPayEnforcerB_Legacy/app/build/outputs/apk/release/app-release.apk
```

## 📦 Installation

### Single Device Installation

```bash
# Install both legacy apps
adb install -r MederPayEnforcerA_Legacy/app/build/outputs/apk/debug/app-debug.apk
adb install -r MederPayEnforcerB_Legacy/app/build/outputs/apk/debug/app-debug.apk
```

### Coexistence with Standard Version

On Android 12+ devices, you can install both versions side-by-side:

```bash
# Install standard versions
adb install -r MederPayEnforcerA/app/build/outputs/apk/debug/app-debug.apk
adb install -r MederPayEnforcerB/app/build/outputs/apk/debug/app-debug.apk

# Install legacy versions (different package names, no conflict)
adb install -r MederPayEnforcerA_Legacy/app/build/outputs/apk/debug/app-debug.apk
adb install -r MederPayEnforcerB_Legacy/app/build/outputs/apk/debug/app-debug.apk
```

This allows testing both versions on the same device.

## ⚙️ Configuration

All configuration is identical to the standard version:

### API Endpoint

Update in `app/build.gradle.kts`:
```kotlin
buildConfigField("String", "API_BASE_URL", "\"https://your-backend.com/api\"")
```

### Embedded APK Names

Same as standard version:
- **App A Legacy:** Embeds `enforcerb.apk`
- **App B Legacy:** Embeds `enforcera.apk`

## 🧪 Testing

### Test on Target Devices

Priority test devices:
1. **Android 5.0-7.1** (API 21-25) - Older Lollipop/Marshmallow/Nougat devices
2. **Android 8.0-9.0** (API 26-28) - Oreo/Pie devices
3. **Android 10-11** (API 29-30) - Recent pre-Android 12 devices

### Key Test Scenarios

#### 1. Mutual Recovery (All Android Versions)
```bash
# Install both apps
adb install app-a-legacy.apk
adb install app-b-legacy.apk

# Remove App B
adb uninstall com.mederpay.enforcerb.legacy

# Expected: App A detects removal and triggers recovery
```

#### 2. Device Admin (Critical on older Android)
```bash
# Check Device Admin functionality
adb shell dumpsys device_policy | grep -i mederpay
```

#### 3. Boot Persistence (OEM-specific)
```bash
# Test auto-start after reboot
adb reboot
# Wait for boot complete
adb shell dumpsys activity services | grep -i mederpay
```

#### 4. Overlay Display (Pre-Android 12)
```bash
# Check overlay permission status
adb shell appops get com.mederpay.enforcera.legacy SYSTEM_ALERT_WINDOW
# Should return: allow
```

## 🔧 Version-Specific Adjustments

### Android 5.0-7.1 (API 21-25)
- **Foreground Service:** Basic implementation without types
- **Broadcast Receivers:** No export flag required
- **Signature Verification:** Uses deprecated `GET_SIGNATURES` API

### Android 8.0-9.0 (API 26-28)
- **Foreground Service:** Requires notification channel
- **Background Limits:** Apps adapt to background execution limits
- **Package Install:** Uses `REQUEST_INSTALL_PACKAGES` permission

### Android 10-11 (API 29-30)
- **Scoped Storage:** FileProvider used for APK sharing
- **Background Location:** N/A for enforcement apps
- **Package Visibility:** Pre-Android 11 uses legacy query methods

## ⚠️ Known Limitations

### Android 5.0-8.0
- **Battery Optimization:** Manual whitelisting required on some devices
- **OEM Restrictions:** MIUI, EMUI require additional permissions
- **Background Limits:** More aggressive on some manufacturers

### Android 9.0-11
- **Foreground Service:** Notification always visible
- **Installer Permission:** Requires manual grant on some devices

## 🛠️ Troubleshooting

### Legacy-Specific Issues

#### Issue: Service Not Starting (Android 5-7)
**Solution:**
- Check battery optimization settings
- Whitelist apps in OEM-specific battery managers
- Verify foreground service notification appears

#### Issue: Package Queries Not Working (Android < 11)
**Solution:**
- This is expected behavior
- Apps use fallback package detection method
- No action required, works as designed

#### Issue: Overlay Not Showing (Android 6-9)
**Solution:**
- Grant "Display over other apps" permission manually
- Settings → Apps → Special Access → Display over other apps
- Enable for both legacy apps

#### Issue: APK Installation Fails (Android 8+)
**Solution:**
- Grant "Install unknown apps" permission
- Settings → Apps → Special Access → Install unknown apps
- Enable for both legacy apps

### OEM-Specific Adjustments

#### Xiaomi (MIUI 9-12)
```
Settings → Permissions → Autostart → Enable for both apps
Settings → Battery & Performance → Manage apps → No restrictions
Security → Permissions → Install via USB → Enable
```

#### Huawei (EMUI 5-11)
```
Settings → Battery → App launch → Manual management → Enable all
Settings → Apps → Apps → Advanced → Special access → Install unknown apps
Phone Manager → Protected apps → Enable for both apps
```

#### Samsung (Android 7-11)
```
Settings → Apps → Special access → Optimize battery usage → All apps → Disable
Device care → Battery → App power management → Apps that won't be put to sleep
```

## 📊 Compatibility Matrix

| Android Version | Status | Notes |
|----------------|--------|-------|
| 5.0 (API 21) | ✅ Supported | Basic enforcement |
| 6.0 (API 23) | ✅ Supported | Runtime permissions |
| 7.0-7.1 (API 24-25) | ✅ Supported | Multi-window support |
| 8.0-8.1 (API 26-27) | ✅ Supported | Notification channels |
| 9.0 (API 28) | ✅ Supported | Full functionality |
| 10 (API 29) | ✅ Supported | Scoped storage |
| 11 (API 30) | ✅ Supported | Package visibility |
| 12+ (API 31+) | ⚠️ Use Standard | Legacy works but use standard |

## 📚 Additional Documentation

- [Parent README](../README.md) - Main project documentation
- [Standard Version README](./README.md) - Android 12+ version
- [Build Instructions](./BUILD_APK_INSTRUCTIONS.md) - Detailed build guide
- [Implementation Status](./IMPLEMENTATION_STATUS.md) - Feature status

## 🤝 Support

For legacy version specific issues:
- **GitHub Issues:** Tag with `android-legacy` label
- **Documentation:** See troubleshooting section above
- **Testing:** Required on physical devices (Android 5-11)

## 📄 Summary

The legacy version provides **full feature parity** with the standard version while supporting older Android devices. The only differences are:
1. Lower minimum SDK (API 21 vs API 31)
2. Different package names (`.legacy` suffix)
3. App name includes "(Legacy)" label
4. Graceful handling of missing newer Android features

**Use Cases:**
- Devices running Android 5.0 - 11
- Markets with older device penetration
- Testing both versions on Android 12+ devices
- Broader device compatibility requirements

---

**Last Updated:** January 20, 2026  
**Version:** 1.0-legacy  
**Supports:** Android 5.0+ (API 21+)
