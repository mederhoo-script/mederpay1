# MederPay Dual-App Build & Deployment Guide

## Overview
This guide explains how to build and deploy the MederPay dual-app security enforcement system consisting of App A (Enforcer A) and App B (Enforcer B).

## System Requirements

### Development Environment
- **Android Studio:** Electric Eel (2022.1.1) or later
- **JDK:** 17 or higher
- **Gradle:** 8.7 (via wrapper)
- **Android SDK:** API 35 (Android 15) minimum
- **Kotlin:** 1.9.23

### Target Devices
- **Minimum SDK:** API 31 (Android 12)
- **Target SDK:** API 35 (Android 15)
- **Hardened Support:** Android 14-17+ with enhanced enforcement

## Architecture Overview

The two apps have a circular dependency:
1. **App A** contains `enforcerb.apk` (embedded)
2. **App B** contains `enforcera.apk` (embedded)
3. Each app can extract and install the other if missing

## Build Process

### Automated Build (Recommended)

The repository includes a build automation script that handles the circular dependency:

```bash
cd /path/to/android
./build-dual-apps.sh release
```

This script performs the following steps:
1. Clean previous builds
2. Build App B initially (without embedded App A)
3. Embed App B APK into App A assets
4. Build App A (with embedded App B)
5. Embed App A APK into App B assets
6. Rebuild App B (with embedded App A)
7. Update App A with final App B
8. Verify embedded APKs exist

**Build Types:**
- `release` - Production build (requires signing)
- `debug` - Development build (debug signing)

### Manual Build Steps

If you need to build manually:

```bash
# Step 1: Build App B (initial)
cd MederPayEnforcerB
./gradlew clean assembleRelease
cp app/build/outputs/apk/release/app-release.apk \
   ../MederPayEnforcerA/app/src/main/assets/enforcerb.apk

# Step 2: Build App A (with embedded App B)
cd ../MederPayEnforcerA
./gradlew clean assembleRelease
cp app/build/outputs/apk/release/app-release.apk \
   ../MederPayEnforcerB/app/src/main/assets/enforcera.apk

# Step 3: Rebuild App B (with embedded App A)
cd ../MederPayEnforcerB
./gradlew clean assembleRelease

# Step 4: Update App A with final App B
cp app/build/outputs/apk/release/app-release.apk \
   ../MederPayEnforcerA/app/src/main/assets/enforcerb.apk
cd ../MederPayEnforcerA
./gradlew clean assembleRelease
```

## APK Signing

### Debug Signing
Debug builds are automatically signed with the debug keystore.

### Release Signing
For production deployment, you must sign the APKs:

```bash
# Create keystore (first time only)
keytool -genkey -v -keystore mederpay-release.keystore \
  -alias mederpay -keyalg RSA -keysize 2048 -validity 10000

# Sign APKs
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore mederpay-release.keystore \
  app-release-unsigned.apk mederpay

# Verify signature
jarsigner -verify -verbose -certs app-release.apk

# Zipalign
zipalign -v 4 app-release-unsigned.apk app-release.apk
```

**Important:** Use the same keystore for both apps to enable proper signature verification.

## Configuration

### API Base URL

Update the API base URL in `app/build.gradle.kts`:

```kotlin
buildConfigField("String", "API_BASE_URL", "\"https://your-api-domain.com/api\"")
```

### Permissions

Both apps require the following permissions (already configured in manifests):
- `INTERNET` - Backend communication
- `FOREGROUND_SERVICE` - Continuous monitoring
- `FOREGROUND_SERVICE_SPECIAL_USE` - Enhanced foreground service
- `RECEIVE_BOOT_COMPLETED` - Boot persistence
- `SYSTEM_ALERT_WINDOW` - Enforcement overlays
- `REQUEST_INSTALL_PACKAGES` - APK recovery installation
- `WAKE_LOCK` - Keep device awake during enforcement

## Deployment

### Installation Order

1. **Install both apps together:**
   ```bash
   adb install -r MederPayEnforcerA.apk
   adb install -r MederPayEnforcerB.apk
   ```

2. **Enable Device Admin for both apps:**
   - Open App A → Enable Device Admin button
   - Open App B → Enable Device Admin button

3. **Grant overlay permission:**
   - Settings → Apps → Special app access → Display over other apps
   - Enable for both MederPay Enforcer A and B

4. **Start enforcement services:**
   - Open each app and tap "Start Enforcement Service"

### First Launch Sequence

On first launch, each app will:
1. Request Device Admin activation
2. Request overlay permission
3. Start foreground enforcement service
4. Perform companion health check
5. Verify or store companion signature hash
6. Begin continuous monitoring loop

### Signature Hash Storage

On first mutual installation:
- App A computes and stores App B's signature hash (encrypted)
- App B computes and stores App A's signature hash (encrypted)
- Subsequent installations verify against stored hash
- Mismatch triggers tamper detection overlay

## Testing

### Manual Test Scenarios

#### Mutual Dependency
```bash
# Test 1: Remove App B
adb uninstall com.mederpay.enforcerb
# Expected: App A shows overlay and triggers recovery

# Test 2: Remove App A
adb uninstall com.mederpay.enforcera
# Expected: App B shows overlay and triggers recovery
```

#### Device Admin
```bash
# Test 3: Disable Device Admin via Settings
# Expected: Overlay appears immediately with enable button
```

#### Boot Persistence
```bash
# Test 4: Reboot device
adb reboot
# Expected: Both services restart automatically
```

#### Signature Verification
```bash
# Test 5: Install unsigned companion
# Expected: Tamper detection overlay appears
```

### Automated Testing

Run unit tests:
```bash
cd MederPayEnforcerA
./gradlew test

cd ../MederPayEnforcerB
./gradlew test
```

## Troubleshooting

### Build Issues

**Problem:** Gradle sync fails
```
Solution: Ensure JDK 17+ is configured in Android Studio
```

**Problem:** Android Gradle Plugin not found
```
Solution: Check internet connectivity and Gradle plugin repositories
```

**Problem:** Embedded APK not found
```
Solution: Run build-dual-apps.sh to properly embed APKs
```

### Runtime Issues

**Problem:** Overlay not showing
```
Solution: Grant SYSTEM_ALERT_WINDOW permission in settings
```

**Problem:** Service not starting on boot
```
Solution: Disable battery optimization for both apps
```

**Problem:** Companion recovery fails
```
Solution: Ensure REQUEST_INSTALL_PACKAGES permission granted
```

### OEM-Specific Issues

#### Xiaomi (MIUI)
1. Settings → Apps → Manage apps → [App] → Permissions → Autostart: Enable
2. Settings → Battery → App battery saver → [App]: No restrictions

#### Samsung (OneUI)
1. Settings → Apps → [App] → Battery → Optimize battery usage: Disabled
2. Settings → Apps → [App] → Mobile data → Allow background data: Enabled

#### Oppo/Realme (ColorOS)
1. Settings → Security → Startup Manager → [App]: Enable
2. Settings → Battery → Battery Optimization → [App]: Don't optimize

## Version-Specific Behavior

### Android 12 (API 31-32) - Fallback Mode
- Standard overlays with activity restart on leave
- Basic foreground service enforcement
- Standard boot persistence

### Android 13+ (API 33+) - Hardened Mode
- Enhanced overlay restrictions
- RECEIVER_NOT_EXPORTED for broadcast receivers
- Special use foreground service type

### Android 14+ (API 34+) - Maximum Hardening
- Task locking hints for Device Admin
- Additional foreground service restrictions
- Enhanced security context

## Security Considerations

### Production Deployment Checklist

- [ ] Use release signing keystore (not debug)
- [ ] Enable ProGuard/R8 obfuscation
- [ ] Configure API_BASE_URL for production backend
- [ ] Store signature hashes securely (SecureStorage)
- [ ] Test on multiple OEM devices (Samsung, Xiaomi, etc.)
- [ ] Verify battery optimization exclusions
- [ ] Test mutual recovery on physical devices
- [ ] Validate Device Admin enforcement
- [ ] Ensure audit logging works with backend
- [ ] Test payment overlay (App A only)

### Known Limitations

1. **Cannot directly check companion's Device Admin status** - Apps rely on backend API for cross-app verification
2. **User can disable via Safe Mode** - Requires additional OEM-specific mitigations
3. **Factory reset removes both apps** - Expected behavior; re-deployment required
4. **Split-screen mode** - Overlays work but user experience may vary on Android 12

## Backend Integration

### Required API Endpoints

Both apps communicate with the Django backend:

```
POST   /api/enforcement/health-check/
GET    /api/enforcement/status/{imei}/
GET    /api/device-commands/pending/
POST   /api/enforcement/audit-log/
GET    /api/settlements/weekly/{imei}/        (App A only)
POST   /api/settlements/{id}/confirm/         (App A only)
```

### Authentication

Currently uses device IMEI (Android ID) for identification. In production, implement:
- JWT token authentication
- Certificate pinning
- API key rotation

## Support

For issues or questions:
- GitHub Issues: [mederhoo-script/mederpay1](https://github.com/mederhoo-script/mederpay1)
- Documentation: See IMPLEMENTATION_STATUS.md for detailed implementation details

## License

Copyright © 2026 MederPay. All rights reserved.
