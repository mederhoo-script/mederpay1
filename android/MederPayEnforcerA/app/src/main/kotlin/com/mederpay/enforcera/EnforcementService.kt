package com.mederpay.enforcera

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.provider.Settings

class EnforcementService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val CHANNEL_ID = "enforcement_channel"
    private val NOTIFICATION_ID = 1

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        startEnforcementLoop()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Enforcement Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Device enforcement and monitoring"
            }
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("MederPay Enforcement Active")
            .setContentText("Monitoring device status")
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun startEnforcementLoop() {
        serviceScope.launch {
            while (isActive) {
                try {
                    performEnforcementCheck()
                    
                    // Process queued audit logs periodically
                    AuditLogger.processQueuedLogs(this@EnforcementService)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
                delay(5 * 60 * 1000) // Check every 5 minutes
            }
        }
    }

    private suspend fun performEnforcementCheck() {
        val imei = getDeviceImei()
        
        // Android 15+ Hardening: Security check FIRST
        val securityReport = SecurityChecker.performSecurityCheck(this)
        
        if (!securityReport.isSecure) {
            val reason = SecurityChecker.getSecurityViolationReason(securityReport)
            
            OverlayManager.showOverlay(
                this,
                OverlayManager.OverlayType.DEVICE_LOCKED,
                "Security Violation",
                "Device security compromised: $reason Contact support.",
                mapOf(
                    "rooted" to securityReport.isRooted.toString(),
                    "debuggable" to securityReport.isDebuggable.toString(),
                    "emulator" to securityReport.isEmulator.toString(),
                    "usb_debug" to securityReport.isUsbDebuggingEnabled.toString(),
                    "android_version" to securityReport.androidVersion.toString()
                )
            )
            
            logAuditEvent("security_violation", mapOf(
                "rooted" to securityReport.isRooted.toString(),
                "debuggable" to securityReport.isDebuggable.toString(),
                "emulator" to securityReport.isEmulator.toString(),
                "usb_debug" to securityReport.isUsbDebuggingEnabled.toString(),
                "security_level" to securityReport.securityLevel.toString()
            ))
            
            return  // Stop enforcement check - device is compromised
        }
        
        // Log warnings (USB debugging, dev mode) but allow operation
        if (securityReport.hasWarnings) {
            logAuditEvent("security_warning", mapOf(
                "usb_debug" to securityReport.isUsbDebuggingEnabled.toString(),
                "dev_mode" to securityReport.isDeveloperModeEnabled.toString()
            ))
        }
        
        // Check Device Admin status
        val devicePolicyManager = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = ComponentName(this, DeviceAdminReceiver::class.java)
        val isDeviceAdminEnabled = devicePolicyManager.isAdminActive(adminComponent)
        
        if (!isDeviceAdminEnabled) {
            OverlayManager.showOverlay(
                this,
                OverlayManager.OverlayType.DEVICE_ADMIN_DISABLED,
                "Device Admin Disabled",
                "Please enable Device Administrator to continue."
            )
            logAuditEvent("device_admin_disabled")
            return
        }

        // Comprehensive companion health check
        val companionHealth = CompanionMonitor.performHealthCheck(this)
        
        if (!companionHealth.isHealthy) {
            val overlayType = when {
                !companionHealth.isInstalled -> OverlayManager.OverlayType.COMPANION_MISSING
                !companionHealth.isEnabled -> OverlayManager.OverlayType.COMPANION_DISABLED
                !companionHealth.signatureValid -> OverlayManager.OverlayType.COMPANION_TAMPERED
                !companionHealth.isDeviceAdminActive -> OverlayManager.OverlayType.COMPANION_DISABLED
                else -> OverlayManager.OverlayType.COMPANION_MISSING
            }
            
            val reason = when {
                !companionHealth.isInstalled -> "Companion App Missing"
                !companionHealth.isEnabled -> "Companion App Disabled"
                !companionHealth.signatureValid -> "Companion App Tampered"
                !companionHealth.isDeviceAdminActive -> "Companion Security Disabled"
                else -> "Companion App Unhealthy"
            }
            
            val message = when {
                !companionHealth.isInstalled -> "Required security companion app is not installed. Restoring..."
                !companionHealth.isEnabled -> "Companion app has been disabled. Please enable it."
                !companionHealth.signatureValid -> "Companion app integrity check failed."
                else -> "Companion app is not functioning properly."
            }
            
            OverlayManager.showOverlay(this, overlayType, reason, message)
            logAuditEvent("companion_unhealthy", mapOf(
                "installed" to companionHealth.isInstalled.toString(),
                "enabled" to companionHealth.isEnabled.toString(),
                "signature_valid" to companionHealth.signatureValid.toString()
            ))
            
            // Trigger recovery if needed
            CompanionMonitor.triggerRecoveryIfNeeded(this)
            return
        }

        // Send health check
        sendHealthCheck(imei, isDeviceAdminEnabled, companionHealth)

        // Get enforcement status from backend
        try {
            val status = ApiClient.service.getEnforcementStatus(imei)
            if (status.should_lock) {
                OverlayManager.showOverlay(
                    this,
                    OverlayManager.OverlayType.PAYMENT_OVERDUE,
                    "Payment Overdue",
                    "Your payment is overdue. Balance: ${status.balance}",
                    mapOf("balance" to status.balance.toString())
                )
            }
        } catch (e: Exception) {
            android.util.Log.e("EnforcementService", "Failed to get enforcement status", e)
        }

        // Check for pending commands
        checkPendingCommands(imei)
        
        // Check for weekly settlement (App A specific)
        checkWeeklySettlement(imei)
    }

    private suspend fun sendHealthCheck(
        imei: String, 
        isDeviceAdminEnabled: Boolean, 
        companionHealth: CompanionHealth
    ) {
        try {
            val healthCheck = HealthCheckRequest(
                imei = imei,
                is_device_admin_enabled = isDeviceAdminEnabled,
                is_companion_app_installed = companionHealth.isInstalled,
                companion_app_version = companionHealth.version,
                android_version = Build.VERSION.RELEASE,
                app_version = BuildConfig.VERSION_NAME,
                battery_level = null,
                is_locked = false,
                lock_reason = null
            )
            ApiClient.service.sendHealthCheck(healthCheck)
        } catch (e: Exception) {
            android.util.Log.e("EnforcementService", "Failed to send health check", e)
        }
    }

    private suspend fun checkPendingCommands(imei: String) {
        try {
            val commands = ApiClient.service.getPendingCommands(imei)
            for (command in commands) {
                ApiClient.service.acknowledgeCommand(command.id)
                
                when (command.command_type) {
                    "lock" -> {
                        OverlayManager.showOverlay(
                            this,
                            OverlayManager.OverlayType.DEVICE_LOCKED,
                            "Device Locked",
                            command.reason
                        )
                    }
                    "unlock" -> {
                        // Dismiss overlay if shown
                        OverlayManager.dismissOverlay(this, OverlayManager.OverlayType.DEVICE_LOCKED)
                    }
                }
                
                ApiClient.service.executeCommand(command.id, mapOf("response" to "executed"))
            }
        } catch (e: Exception) {
            android.util.Log.e("EnforcementService", "Failed to check pending commands", e)
        }
    }

    private fun getDeviceImei(): String {
        // In production, retrieve actual IMEI
        // For demo purposes, using Android ID
        return Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
    }

    /**
     * Check for weekly settlement dues (App A specific)
     * Android 15+ Hardening: Use OverlayManager for non-dismissible enforcement
     */
    private suspend fun checkWeeklySettlement(imei: String) {
        try {
            // Call backend API to check settlement status
            val settlementStatus = ApiClient.service.getWeeklySettlement(imei)
            
            if (settlementStatus.has_settlement && (settlementStatus.is_due || settlementStatus.is_overdue)) {
                // Android 15+ Fix: Use OverlayManager for truly non-dismissible overlay
                // This prevents users from dismissing via home button
                OverlayManager.showOverlay(
                    this,
                    OverlayManager.OverlayType.SETTLEMENT_DUE,
                    if (settlementStatus.is_overdue) "Settlement Overdue" else "Settlement Due",
                    "Amount: ₦${settlementStatus.amount_due ?: 0.0}. Operations blocked until paid. " +
                            "Settlement ID: ${settlementStatus.settlement_id ?: "N/A"}",
                    mapOf(
                        "settlement_id" to (settlementStatus.settlement_id ?: ""),
                        "amount" to (settlementStatus.amount_due?.toString() ?: "0"),
                        "due_date" to (settlementStatus.due_date ?: ""),
                        "is_overdue" to settlementStatus.is_overdue.toString()
                    )
                )
                
                logAuditEvent("settlement_enforcement_triggered", mapOf(
                    "amount" to (settlementStatus.amount_due?.toString() ?: "0"),
                    "is_overdue" to settlementStatus.is_overdue.toString(),
                    "settlement_id" to (settlementStatus.settlement_id ?: "unknown"),
                    "overlay_type" to "OverlayManager"
                ))
                
                android.util.Log.i("EnforcementService", "Settlement enforcement triggered via OverlayManager - Due: ${settlementStatus.amount_due}")
            } else {
                android.util.Log.d("EnforcementService", "No settlement due - Status: ${settlementStatus.message}")
                
                // Dismiss overlay if settlement is now paid
                if (settlementStatus.is_paid) {
                    OverlayManager.dismissOverlay(this, OverlayManager.OverlayType.SETTLEMENT_DUE)
                    android.util.Log.i("EnforcementService", "Settlement paid - Overlay dismissed")
                }
            }
            
        } catch (e: Exception) {
            android.util.Log.e("EnforcementService", "Failed to check weekly settlement", e)
        }
    }
    
    private fun logAuditEvent(event: String, data: Map<String, String> = emptyMap()) {
        serviceScope.launch {
            try {
                val imei = getDeviceImei()
                AuditLogger.logEvent(this@EnforcementService, imei, event, data)
                android.util.Log.i("EnforcementService", "Audit event logged: $event")
            } catch (e: Exception) {
                android.util.Log.e("EnforcementService", "Failed to log audit event", e)
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        
        // Process any queued audit logs before shutting down
        serviceScope.launch {
            try {
                AuditLogger.processQueuedLogs(this@EnforcementService)
            } catch (e: Exception) {
                android.util.Log.e("EnforcementService", "Failed to process queued logs on destroy", e)
            }
        }
        
        serviceScope.cancel()
    }
}
