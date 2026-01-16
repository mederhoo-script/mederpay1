# MederPay Enforcer A ProGuard Rules

# Keep application class
-keep class com.mederpay.enforcerb.** { *; }

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

# Data classes
-keep class com.mederpay.enforcerb.EnforcementStatus { *; }
-keep class com.mederpay.enforcerb.HealthCheckRequest { *; }
-keep class com.mederpay.enforcerb.DeviceCommand { *; }
-keep class com.mederpay.enforcerb.AuditLogEntry { *; }
-keep class com.mederpay.enforcerb.AuditLogResponse { *; }
-keep class com.mederpay.enforcerb.WeeklySettlementResponse { *; }
-keep class com.mederpay.enforcerb.ConfirmSettlementPaymentRequest { *; }
-keep class com.mederpay.enforcerb.ConfirmSettlementPaymentResponse { *; }
-keep class com.mederpay.enforcerb.CompanionHealth { *; }
-keep class com.mederpay.enforcerb.OverlayState { *; }

# Keep Device Admin Receiver
-keep class com.mederpay.enforcerb.DeviceAdminReceiver { *; }
-keep class com.mederpay.enforcerb.BootReceiver { *; }
-keep class com.mederpay.enforcerb.PackageChangeReceiver { *; }

# Keep Activities
-keep class com.mederpay.enforcerb.MainActivity { *; }
-keep class com.mederpay.enforcerb.OverlayActivity { *; }
-keep class com.mederpay.enforcerb.PaymentOverlay { *; }

# Keep Services
-keep class com.mederpay.enforcerb.EnforcementService { *; }

# Keep critical security classes from obfuscation
-keep class com.mederpay.enforcerb.CompanionMonitor { *; }
-keep class com.mederpay.enforcerb.RecoveryInstaller { *; }
-keep class com.mederpay.enforcerb.SecureStorage { *; }
-keep class com.mederpay.enforcerb.OverlayManager { *; }
-keep class com.mederpay.enforcerb.AuditLogger { *; }
-keep class com.mederpay.enforcerb.ApiClient { *; }
-keep class com.mederpay.enforcerb.MonnifyPaymentManager { *; }

# Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
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
