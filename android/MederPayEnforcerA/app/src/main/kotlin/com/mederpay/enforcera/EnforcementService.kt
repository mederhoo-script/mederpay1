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
                } catch (e: Exception) {
                    e.printStackTrace()
                }
                delay(5 * 60 * 1000) // Check every 5 minutes
            }
        }
    }

    private suspend fun performEnforcementCheck() {
        val imei = getDeviceImei()
        
        // Check Device Admin status
        val devicePolicyManager = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = ComponentName(this, DeviceAdminReceiver::class.java)
        val isDeviceAdminEnabled = devicePolicyManager.isAdminActive(adminComponent)
        
        if (!isDeviceAdminEnabled) {
            showEnforcementOverlay("Device Admin Disabled", 
                "Please enable Device Administrator to continue.")
            return
        }

        // Check companion app
        val isCompanionInstalled = CompanionMonitor.isCompanionAppInstalled(this)
        if (!isCompanionInstalled) {
            showEnforcementOverlay("Companion App Missing", 
                "Required companion app is not installed.")
        }

        // Send health check
        sendHealthCheck(imei, isDeviceAdminEnabled, isCompanionInstalled)

        // Get enforcement status from backend
        try {
            val status = ApiClient.service.getEnforcementStatus(imei)
            if (status.should_lock) {
                showEnforcementOverlay("Payment Overdue", 
                    "Your payment is overdue. Balance: ${status.balance}")
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Check for pending commands
        checkPendingCommands(imei)
    }

    private suspend fun sendHealthCheck(imei: String, isDeviceAdminEnabled: Boolean, isCompanionInstalled: Boolean) {
        try {
            val healthCheck = HealthCheckRequest(
                imei = imei,
                is_device_admin_enabled = isDeviceAdminEnabled,
                is_companion_app_installed = isCompanionInstalled,
                companion_app_version = if (isCompanionInstalled) "1.0" else null,
                android_version = Build.VERSION.RELEASE,
                app_version = BuildConfig.VERSION_NAME,
                battery_level = null,
                is_locked = false,
                lock_reason = null
            )
            ApiClient.service.sendHealthCheck(healthCheck)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private suspend fun checkPendingCommands(imei: String) {
        try {
            val commands = ApiClient.service.getPendingCommands(imei)
            for (command in commands) {
                ApiClient.service.acknowledgeCommand(command.id)
                
                when (command.command_type) {
                    "lock" -> {
                        showEnforcementOverlay("Device Locked", command.reason)
                    }
                    "unlock" -> {
                        // Dismiss overlay if shown
                    }
                }
                
                ApiClient.service.executeCommand(command.id, mapOf("response" to "executed"))
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun showEnforcementOverlay(reason: String, message: String) {
        val intent = Intent(this, OverlayActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("reason", reason)
            putExtra("message", message)
        }
        startActivity(intent)
    }

    private fun getDeviceImei(): String {
        // In production, retrieve actual IMEI
        // For demo purposes, using Android ID
        return Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }
}
