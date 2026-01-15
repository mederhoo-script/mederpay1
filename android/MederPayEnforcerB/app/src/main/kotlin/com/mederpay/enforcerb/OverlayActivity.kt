package com.mederpay.enforcerb

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.KeyEvent
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.util.Log

class OverlayActivity : Activity() {
    private val TAG = "OverlayActivity"
    private var overlayType: OverlayManager.OverlayType? = null
    private val dismissReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val type = intent?.getStringExtra("overlay_type")
            if (type != null && type == overlayType?.name) {
                Log.i(TAG, "Received dismissal broadcast for $type")
                finish()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Get overlay state from OverlayManager or intent
        val overlayState = OverlayManager.getOverlayState(this)
        if (overlayState != null) {
            overlayType = overlayState.type
        } else {
            // Fallback to intent extras
            val typeString = intent.getStringExtra("overlay_type")
            overlayType = try {
                if (typeString != null) OverlayManager.OverlayType.valueOf(typeString) else null
            } catch (e: IllegalArgumentException) {
                null
            }
        }

        val reason = overlayState?.reason ?: intent.getStringExtra("reason") ?: "Device Locked"
        val message = overlayState?.message ?: intent.getStringExtra("message") ?: "Please contact your agent."
        val isHardened = intent.getBooleanExtra("hardened", false)

        // Register broadcast receiver for dismissal
        val filter = IntentFilter("com.mederpay.enforcerb.DISMISS_OVERLAY")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(dismissReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(dismissReceiver, filter)
        }

        // Create UI based on overlay type
        setContentView(createOverlayUI(reason, message, isHardened))
    }

    private fun createOverlayUI(reason: String, message: String, isHardened: Boolean): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(50, 50, 50, 50)
            gravity = Gravity.CENTER
            setBackgroundColor(
                when (overlayType) {
                    OverlayManager.OverlayType.PAYMENT_OVERDUE,
                    OverlayManager.OverlayType.SETTLEMENT_DUE -> android.graphics.Color.parseColor("#FF6B6B")
                    OverlayManager.OverlayType.DEVICE_LOCKED -> android.graphics.Color.parseColor("#DC143C")
                    OverlayManager.OverlayType.COMPANION_TAMPERED -> android.graphics.Color.parseColor("#8B0000")
                    else -> android.graphics.Color.RED
                }
            )

            // Title
            addView(TextView(this@OverlayActivity).apply {
                text = reason
                textSize = if (isHardened) 28f else 24f
                setTextColor(android.graphics.Color.WHITE)
                gravity = Gravity.CENTER
                setPadding(0, 0, 0, 30)
            })

            // Message
            addView(TextView(this@OverlayActivity).apply {
                text = message
                textSize = 16f
                setTextColor(android.graphics.Color.WHITE)
                gravity = Gravity.CENTER
                setPadding(0, 0, 0, 40)
            })

            // Type-specific action buttons
            when (overlayType) {
                OverlayManager.OverlayType.DEVICE_ADMIN_DISABLED -> {
                    addView(createActionButton("Enable Device Admin") {
                        enableDeviceAdmin()
                    })
                }
                OverlayManager.OverlayType.COMPANION_MISSING,
                OverlayManager.OverlayType.COMPANION_DISABLED -> {
                    addView(createActionButton("Restore Companion App") {
                        launchRecovery()
                    })
                }
                OverlayManager.OverlayType.COMPANION_TAMPERED -> {
                    addView(createActionButton("Restore Security") {
                        launchRecovery()
                    })
                }
                OverlayManager.OverlayType.PAYMENT_OVERDUE,
                OverlayManager.OverlayType.SETTLEMENT_DUE -> {
                    addView(TextView(this@OverlayActivity).apply {
                        text = "Payment required to continue"
                        textSize = 14f
                        setTextColor(android.graphics.Color.WHITE)
                        gravity = Gravity.CENTER
                        setPadding(0, 0, 0, 20)
                    })
                    // Note: Payment overlay would go here (needs Monnify integration)
                }
                else -> {
                    addView(createActionButton("Check Status") {
                        checkStatus()
                    })
                }
            }

            // Hardened mode indicator
            if (isHardened) {
                addView(TextView(this@OverlayActivity).apply {
                    text = "Enhanced Security Mode"
                    textSize = 12f
                    setTextColor(android.graphics.Color.parseColor("#FFD700"))
                    gravity = Gravity.CENTER
                    setPadding(0, 40, 0, 0)
                })
            }
        }
    }

    private fun createActionButton(text: String, onClick: () -> Unit): Button {
        return Button(this).apply {
            this.text = text
            textSize = 16f
            setBackgroundColor(android.graphics.Color.parseColor("#2E8B57"))
            setTextColor(android.graphics.Color.WHITE)
            setPadding(40, 20, 40, 20)
            setOnClickListener { onClick() }
        }
    }

    private fun enableDeviceAdmin() {
        val devicePolicyManager = getSystemService(DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val adminComponent = ComponentName(this, DeviceAdminReceiver::class.java)

        if (!devicePolicyManager.isAdminActive(adminComponent)) {
            val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
                putExtra(
                    DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                    "This app requires device admin access for payment enforcement."
                )
            }
            startActivity(intent)
        } else {
            overlayType?.let { type ->
                OverlayManager.dismissOverlay(this, type)
            }
            finish()
        }
    }

    private fun launchRecovery() {
        Log.i(TAG, "Launching recovery process")
        // Trigger recovery via RecoveryInstaller
        Thread {
            try {
                RecoveryInstaller.triggerRecovery(this)
            } catch (e: Exception) {
                Log.e(TAG, "Recovery failed", e)
            }
        }.start()
    }

    private fun checkStatus() {
        Log.i(TAG, "Checking status")
        // Recheck conditions - this will be handled by EnforcementService
        overlayType?.let { type ->
            OverlayManager.dismissOverlay(this, type)
        }
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(dismissReceiver)
        } catch (e: Exception) {
            // Receiver not registered or already unregistered
        }
    }

    // Prevent back button
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onBackPressed() {
        // Prevent back navigation
    }
}
