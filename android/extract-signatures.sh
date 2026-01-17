#!/bin/bash
# Extract APK signatures for compile-time pinning
# Run this after building APKs with ./build-dual-apps.sh release

set -e

echo "=== APK Signature Extractor ==="
echo

# Check if APKs exist
APP_A_APK="MederPayEnforcerA/app/build/outputs/apk/release/app-release.apk"
APP_B_APK="MederPayEnforcerB/app/build/outputs/apk/release/app-release.apk"

if [ ! -f "$APP_A_APK" ]; then
    echo "Error: App A APK not found at $APP_A_APK"
    echo "Run ./build-dual-apps.sh release first"
    exit 1
fi

if [ ! -f "$APP_B_APK" ]; then
    echo "Error: App B APK not found at $APP_B_APK"
    echo "Run ./build-dual-apps.sh release first"
    exit 1
fi

echo "Extracting App A signature..."
APP_A_SIG=$(keytool -printcert -jarfile "$APP_A_APK" | grep "SHA256:" | sed 's/.*SHA256: //' | tr -d ':' | tr '[:upper:]' '[:lower:]')

echo "Extracting App B signature..."
APP_B_SIG=$(keytool -printcert -jarfile "$APP_B_APK" | grep "SHA256:" | sed 's/.*SHA256: //' | tr -d ':' | tr '[:upper:]' '[:lower:]')

echo
echo "=== Signatures Extracted ==="
echo
echo "App A (MederPayEnforcerA) SHA-256:"
echo "$APP_A_SIG"
echo
echo "App B (MederPayEnforcerB) SHA-256:"
echo "$APP_B_SIG"
echo
echo "=== Next Steps ==="
echo "1. Copy these signatures into SignatureVerifier.kt files:"
echo "   - For App A: Update EXPECTED_APP_A_SIGNATURE in MederPayEnforcerB/SignatureVerifier.kt"
echo "   - For App B: Update EXPECTED_APP_B_SIGNATURE in MederPayEnforcerA/SignatureVerifier.kt"
echo
echo "2. Replace the PLACEHOLDER values with the signatures above"
echo
echo "3. Rebuild both apps to include the pinned signatures"
echo
