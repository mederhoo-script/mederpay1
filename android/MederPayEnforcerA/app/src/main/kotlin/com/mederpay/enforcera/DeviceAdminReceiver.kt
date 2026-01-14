package com.mederpay.enforcera

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast

class DeviceAdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Toast.makeText(context, "Device Admin Enabled", Toast.LENGTH_SHORT).show()
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Toast.makeText(context, "Device Admin Disabled - Enforcement Required", Toast.LENGTH_SHORT).show()
        
        // Start overlay activity
        val overlayIntent = Intent(context, OverlayActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
            putExtra("reason", "Device Admin Disabled")
            putExtra("message", "Please enable Device Administrator to continue using this device.")
        }
        context.startActivity(overlayIntent)
    }
}
