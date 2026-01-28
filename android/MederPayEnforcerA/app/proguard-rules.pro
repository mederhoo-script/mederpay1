# MederPay Enforcer A ProGuard Rules

# Keep only essential application classes from obfuscation
# Allow obfuscation of internal implementation details for better security

# Keep main entry points (Activities)
-keep class com.mederpay.enforcera.MainActivity { *; }
-keep class com.mederpay.enforcera.OverlayActivity { *; }
-keep class com.mederpay.enforcera.PaymentOverlay { *; }

# Keep Device Admin and Broadcast Receivers (required by Android)
-keep class com.mederpay.enforcera.DeviceAdminReceiver { *; }
-keep class com.mederpay.enforcera.BootReceiver { *; }
-keep class com.mederpay.enforcera.PackageChangeReceiver { *; }

# Keep Services
-keep class com.mederpay.enforcera.EnforcementService { *; }

# Retrofit
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-keepattributes Signature
-keepattributes Exceptions
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}

# Gson
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn sun.misc.**
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# Data classes (used by Retrofit/Gson)
-keep class com.mederpay.enforcera.EnforcementStatus { *; }
-keep class com.mederpay.enforcera.HealthCheckRequest { *; }
-keep class com.mederpay.enforcera.DeviceCommand { *; }
-keep class com.mederpay.enforcera.AuditLogEntry { *; }
-keep class com.mederpay.enforcera.AuditLogResponse { *; }
-keep class com.mederpay.enforcera.WeeklySettlementResponse { *; }
-keep class com.mederpay.enforcera.ConfirmSettlementPaymentRequest { *; }
-keep class com.mederpay.enforcera.ConfirmSettlementPaymentResponse { *; }
-keep class com.mederpay.enforcera.CompanionHealth { *; }
-keep class com.mederpay.enforcera.OverlayState { *; }
-keep class com.mederpay.enforcera.ReservedAccountInfo { *; }
-keep class com.mederpay.enforcera.ReservedAccountResponse { *; }

# Coroutines
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembernames class kotlinx.** {
    volatile <fields>;
}

# Kotlin
-keep class kotlin.Metadata { *; }
-keepclassmembers class kotlin.Metadata {
    public <methods>;
}

# Android Components
-keep class * extends android.app.Activity
-keep class * extends android.app.Service
-keep class * extends android.content.BroadcastReceiver
-keep class * extends android.app.Application

# FileProvider
-keep class androidx.core.content.FileProvider { *; }

# Remove logging in release
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}

# Optimization settings
-optimizationpasses 5
-dontusemixedcaseclassnames
-verbose

# Keep line numbers for debugging stack traces
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
