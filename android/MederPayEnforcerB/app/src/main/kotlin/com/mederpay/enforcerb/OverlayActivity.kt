package com.mederpay.enforcerb

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.view.KeyEvent
import android.widget.Button
import android.widget.TextView

class OverlayActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Simple layout programmatically
        val layout = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(50, 50, 50, 50)
            setBackgroundColor(android.graphics.Color.RED)
        }

        val reason = intent.getStringExtra("reason") ?: "Device Locked"
        val message = intent.getStringExtra("message") ?: "Please contact your agent."

        val titleView = TextView(this).apply {
            text = reason
            textSize = 24f
            setTextColor(android.graphics.Color.WHITE)
            setPadding(0, 0, 0, 20)
        }

        val messageView = TextView(this).apply {
            text = message
            textSize = 16f
            setTextColor(android.graphics.Color.WHITE)
            setPadding(0, 0, 0, 40)
        }

        val actionButton = Button(this).apply {
            text = "Enable Device Admin"
            setOnClickListener {
                enableDeviceAdmin()
            }
        }

        layout.addView(titleView)
        layout.addView(messageView)
        layout.addView(actionButton)

        setContentView(layout)
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
            finish()
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
