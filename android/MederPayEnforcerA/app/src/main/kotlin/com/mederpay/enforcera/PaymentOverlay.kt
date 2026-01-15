package com.mederpay.enforcera

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.KeyEvent
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

/**
 * PaymentOverlay - Specialized overlay for payment settlement enforcement.
 * Displays persistent non-dismissible overlay when payment is due.
 * Integrates with Monnify payment flow.
 */
class PaymentOverlay : Activity() {
    private val TAG = "PaymentOverlay"
    private var settlementAmount: Double = 0.0
    private var settlementId: String? = null
    
    private val dismissReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            Log.i(TAG, "Received payment confirmation, dismissing overlay")
            finish()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Extract payment details from intent
        settlementAmount = intent.getDoubleExtra("settlement_amount", 0.0)
        settlementId = intent.getStringExtra("settlement_id")
        val dueDate = intent.getStringExtra("due_date") ?: "Now"
        val isOverdue = intent.getBooleanExtra("is_overdue", false)
        
        Log.i(TAG, "Payment overlay shown - Amount: $settlementAmount, Due: $dueDate, Overdue: $isOverdue")
        
        // Register broadcast receiver for payment confirmation
        val filter = IntentFilter("com.mederpay.enforcera.PAYMENT_CONFIRMED")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(dismissReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(dismissReceiver, filter)
        }
        
        // Log enforcement event
        AuditLogger.log(this, "payment_overlay_shown", mapOf(
            "amount" to settlementAmount.toString(),
            "settlement_id" to (settlementId ?: "unknown"),
            "is_overdue" to isOverdue.toString()
        ))
        
        // Create payment UI
        setContentView(createPaymentUI(settlementAmount, dueDate, isOverdue))
    }
    
    private fun createPaymentUI(amount: Double, dueDate: String, isOverdue: Boolean): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(50, 50, 50, 50)
            gravity = Gravity.CENTER
            setBackgroundColor(
                if (isOverdue) 
                    android.graphics.Color.parseColor("#DC143C")  // Crimson red for overdue
                else 
                    android.graphics.Color.parseColor("#FF6B6B")  // Lighter red for due
            )
            
            // Title
            addView(TextView(this@PaymentOverlay).apply {
                text = if (isOverdue) "PAYMENT OVERDUE" else "WEEKLY SETTLEMENT DUE"
                textSize = 28f
                setTextColor(android.graphics.Color.WHITE)
                gravity = Gravity.CENTER
                setPadding(0, 0, 0, 30)
                setTypeface(null, android.graphics.Typeface.BOLD)
            })
            
            // Amount display
            addView(TextView(this@PaymentOverlay).apply {
                text = "Amount Due"
                textSize = 16f
                setTextColor(android.graphics.Color.parseColor("#FFD700"))
                gravity = Gravity.CENTER
                setPadding(0, 0, 0, 10)
            })
            
            addView(TextView(this@PaymentOverlay).apply {
                text = "₦${String.format("%,.2f", amount)}"
                textSize = 48f
                setTextColor(android.graphics.Color.WHITE)
                gravity = Gravity.CENTER
                setPadding(0, 0, 0, 20)
                setTypeface(null, android.graphics.Typeface.BOLD)
            })
            
            // Due date
            addView(TextView(this@PaymentOverlay).apply {
                text = "Due: $dueDate"
                textSize = 14f
                setTextColor(android.graphics.Color.WHITE)
                gravity = Gravity.CENTER
                setPadding(0, 0, 0, 40)
            })
            
            // Pay Now button
            addView(Button(this@PaymentOverlay).apply {
                text = "PAY NOW"
                textSize = 20f
                setBackgroundColor(android.graphics.Color.parseColor("#2E8B57"))  // Sea green
                setTextColor(android.graphics.Color.WHITE)
                setPadding(60, 30, 60, 30)
                setTypeface(null, android.graphics.Typeface.BOLD)
                setOnClickListener { initiatePayment() }
            })
            
            // Warning message
            addView(TextView(this@PaymentOverlay).apply {
                text = if (isOverdue)
                    "Your account is suspended. Pay now to restore access."
                else
                    "Payment required to continue using the device."
                textSize = 14f
                setTextColor(android.graphics.Color.WHITE)
                gravity = Gravity.CENTER
                setPadding(0, 40, 0, 0)
                alpha = 0.9f
            })
            
            // Overdue indicator
            if (isOverdue) {
                addView(TextView(this@PaymentOverlay).apply {
                    text = "⚠ OVERDUE ⚠"
                    textSize = 16f
                    setTextColor(android.graphics.Color.parseColor("#FFD700"))
                    gravity = Gravity.CENTER
                    setPadding(0, 20, 0, 0)
                    setTypeface(null, android.graphics.Typeface.BOLD)
                })
            }
        }
    }
    
    private fun initiatePayment() {
        Log.i(TAG, "Initiating payment for settlement: $settlementId, amount: $settlementAmount")
        
        if (settlementId == null || settlementAmount <= 0) {
            Toast.makeText(this, "Invalid payment details", Toast.LENGTH_LONG).show()
            Log.e(TAG, "Invalid payment parameters")
            return
        }
        
        // Log payment initiation
        AuditLogger.log(this, "payment_initiated", mapOf(
            "amount" to settlementAmount.toString(),
            "settlement_id" to settlementId!!
        ))
        
        try {
            // Initiate Monnify payment
            MonnifyPaymentManager.initiatePayment(
                activity = this,
                amount = settlementAmount,
                settlementId = settlementId!!,
                onSuccess = { reference ->
                    Log.i(TAG, "Payment successful: $reference")
                    handlePaymentSuccess(reference)
                },
                onFailure = { error ->
                    Log.e(TAG, "Payment failed: $error")
                    handlePaymentFailure(error)
                },
                onCancelled = {
                    Log.i(TAG, "Payment cancelled by user")
                    handlePaymentCancelled()
                }
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error initiating payment", e)
            Toast.makeText(this, "Payment system error: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }
    
    private fun handlePaymentSuccess(reference: String) {
        // Log success
        AuditLogger.log(this, "payment_completed", mapOf(
            "reference" to reference,
            "amount" to settlementAmount.toString(),
            "settlement_id" to (settlementId ?: "unknown")
        ))
        
        // Notify backend
        MonnifyPaymentManager.confirmPaymentWithBackend(
            context = this,
            settlementId = settlementId!!,
            paymentReference = reference,
            amount = settlementAmount
        )
        
        // Dismiss overlay
        OverlayManager.dismissOverlay(this, OverlayManager.OverlayType.SETTLEMENT_DUE)
        
        Toast.makeText(this, "Payment successful! Thank you.", Toast.LENGTH_LONG).show()
        finish()
    }
    
    private fun handlePaymentFailure(error: String) {
        AuditLogger.log(this, "payment_failed", mapOf(
            "error" to error,
            "amount" to settlementAmount.toString(),
            "settlement_id" to (settlementId ?: "unknown")
        ))
        
        Toast.makeText(this, "Payment failed: $error\nPlease try again.", Toast.LENGTH_LONG).show()
    }
    
    private fun handlePaymentCancelled() {
        AuditLogger.log(this, "payment_cancelled", mapOf(
            "amount" to settlementAmount.toString(),
            "settlement_id" to (settlementId ?: "unknown")
        ))
        
        Toast.makeText(this, "Payment cancelled. Overlay will persist.", Toast.LENGTH_SHORT).show()
        // Overlay remains visible - payment still required
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
            Toast.makeText(this, "Payment required to continue", Toast.LENGTH_SHORT).show()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }
    
    override fun onBackPressed() {
        // Prevent back navigation
        Toast.makeText(this, "Payment required to continue", Toast.LENGTH_SHORT).show()
    }
}
