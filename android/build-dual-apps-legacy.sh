#!/bin/bash

# MederPay Dual-App Build Script (Legacy Version for Android 5.0+)
# This script automates the circular build dependency for embedding APKs

set -e  # Exit on error

echo "=========================================="
echo "MederPay Dual-App Build Automation (Legacy)"
echo "For Android 5.0 - 11 (API 21-30)"
echo "=========================================="
echo ""

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
APP_A_DIR="$PROJECT_ROOT/MederPayEnforcerA_Legacy"
APP_B_DIR="$PROJECT_ROOT/MederPayEnforcerB_Legacy"
BUILD_TYPE="${1:-release}"  # Default to release, can override with 'debug'

# Validate build type
if [[ "$BUILD_TYPE" != "release" && "$BUILD_TYPE" != "debug" ]]; then
    echo "Error: Build type must be 'release' or 'debug'"
    echo "Usage: ./build-dual-apps-legacy.sh [release|debug]"
    exit 1
fi

BUILD_TYPE_CAPITALIZED="$(echo ${BUILD_TYPE:0:1} | tr '[:lower:]' '[:upper:]')${BUILD_TYPE:1}"

echo "Build Type: $BUILD_TYPE_CAPITALIZED"
echo "App A Directory: $APP_A_DIR"
echo "App B Directory: $APP_B_DIR"
echo ""

# Step 1: Clean previous builds
echo "Step 1/7: Cleaning previous builds..."
cd "$APP_A_DIR"
./gradlew clean > /dev/null 2>&1 || true
cd "$APP_B_DIR"
./gradlew clean > /dev/null 2>&1 || true
echo "✓ Clean complete"
echo ""

# Step 2: Initial build of App B (without embedded App A)
echo "Step 2/7: Building App B (initial)..."
cd "$APP_B_DIR"
./gradlew assemble${BUILD_TYPE_CAPITALIZED}
APK_B_INITIAL="$APP_B_DIR/app/build/outputs/apk/$BUILD_TYPE/app-${BUILD_TYPE}.apk"

if [ ! -f "$APK_B_INITIAL" ]; then
    echo "Error: App B APK not found at $APK_B_INITIAL"
    exit 1
fi

echo "✓ App B built successfully"
echo "  Location: $APK_B_INITIAL"
echo ""

# Step 3: Embed App B APK into App A assets
echo "Step 3/7: Embedding App B APK into App A..."
ASSETS_A="$APP_A_DIR/app/src/main/assets"
mkdir -p "$ASSETS_A"
cp "$APK_B_INITIAL" "$ASSETS_A/enforcerb.apk"
echo "✓ App B embedded into App A"
echo "  Destination: $ASSETS_A/enforcerb.apk"
echo ""

# Step 4: Build App A (with embedded App B)
echo "Step 4/7: Building App A (with embedded App B)..."
cd "$APP_A_DIR"
./gradlew assemble${BUILD_TYPE_CAPITALIZED}
APK_A="$APP_A_DIR/app/build/outputs/apk/$BUILD_TYPE/app-${BUILD_TYPE}.apk"

if [ ! -f "$APK_A" ]; then
    echo "Error: App A APK not found at $APK_A"
    exit 1
fi

echo "✓ App A built successfully"
echo "  Location: $APK_A"
echo ""

# Step 5: Embed App A APK into App B assets
echo "Step 5/7: Embedding App A APK into App B..."
ASSETS_B="$APP_B_DIR/app/src/main/assets"
mkdir -p "$ASSETS_B"
cp "$APK_A" "$ASSETS_B/enforcera.apk"
echo "✓ App A embedded into App B"
echo "  Destination: $ASSETS_B/enforcera.apk"
echo ""

# Step 6: Rebuild App B (with embedded App A)
echo "Step 6/7: Rebuilding App B (with embedded App A)..."
cd "$APP_B_DIR"
./gradlew clean
./gradlew assemble${BUILD_TYPE_CAPITALIZED}
APK_B_FINAL="$APP_B_DIR/app/build/outputs/apk/$BUILD_TYPE/app-${BUILD_TYPE}.apk"

if [ ! -f "$APK_B_FINAL" ]; then
    echo "Error: Final App B APK not found at $APK_B_FINAL"
    exit 1
fi

echo "✓ App B rebuilt successfully"
echo "  Location: $APK_B_FINAL"
echo ""

# Step 7: Update App A with final App B
echo "Step 7/7: Updating App A with final App B..."
cp "$APK_B_FINAL" "$ASSETS_A/enforcerb.apk"
cd "$APP_A_DIR"
./gradlew clean
./gradlew assemble${BUILD_TYPE_CAPITALIZED}
APK_A_FINAL="$APP_A_DIR/app/build/outputs/apk/$BUILD_TYPE/app-${BUILD_TYPE}.apk"

if [ ! -f "$APK_A_FINAL" ]; then
    echo "Error: Final App A APK not found at $APK_A_FINAL"
    exit 1
fi

echo "✓ App A rebuilt successfully"
echo "  Location: $APK_A_FINAL"
echo ""

# Verification
echo "=========================================="
echo "Build Verification"
echo "=========================================="
echo ""

# Check APK sizes
APP_A_SIZE=$(du -h "$APK_A_FINAL" | cut -f1)
APP_B_SIZE=$(du -h "$APK_B_FINAL" | cut -f1)

echo "App A Legacy ($BUILD_TYPE_CAPITALIZED):"
echo "  Package: com.mederpay.enforcera.legacy"
echo "  Path: $APK_A_FINAL"
echo "  Size: $APP_A_SIZE"
echo "  Contains: enforcerb.apk in assets"
echo "  Supports: Android 5.0+ (API 21+)"
echo ""

echo "App B Legacy ($BUILD_TYPE_CAPITALIZED):"
echo "  Package: com.mederpay.enforcerb.legacy"
echo "  Path: $APK_B_FINAL"
echo "  Size: $APP_B_SIZE"
echo "  Contains: enforcera.apk in assets"
echo "  Supports: Android 5.0+ (API 21+)"
echo ""

# Check if embedded APKs exist
echo "Checking embedded APKs..."
if unzip -l "$APK_A_FINAL" | grep -q "assets/enforcerb.apk"; then
    echo "✓ App A contains embedded enforcerb.apk"
else
    echo "✗ WARNING: App A does NOT contain embedded enforcerb.apk"
fi

if unzip -l "$APK_B_FINAL" | grep -q "assets/enforcera.apk"; then
    echo "✓ App B contains embedded enforcera.apk"
else
    echo "✗ WARNING: App B does NOT contain embedded enforcera.apk"
fi

echo ""
echo "=========================================="
echo "Build Complete!"
echo "=========================================="
echo ""
echo "✓ Legacy version supports Android 5.0 - 11"
echo "✓ Can be installed alongside regular version"
echo "✓ Different package names prevent conflicts"
echo ""
echo "Next Steps:"
echo "1. Sign the APKs for release deployment"
echo "2. Test on Android 5-11 device(s)"
echo "3. Verify mutual recovery functionality"
echo ""
echo "Installation commands:"
echo "  adb install -r $APK_A_FINAL"
echo "  adb install -r $APK_B_FINAL"
echo ""
echo "Note: Legacy and regular versions can coexist on Android 12+"
echo ""
