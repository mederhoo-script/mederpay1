# What Needs to Be Fixed - Action Plan

Based on the comprehensive enterprise audit, here are the **6 critical fixes** you need to implement to make MederPay production-ready.

---

## 🚨 PRIORITY 0 - BLOCKING (Must Fix to Launch)

### 1. Payment Settlement Enforcement (2-3 days)

**Problem:** The weekly settlement enforcement doesn't actually work. Agents can bypass it.

**What's Wrong:**
- `PaymentOverlay.kt` exists but isn't properly integrated with `OverlayManager`
- Overlay can be dismissed by pressing home button
- No backend enforcement - agents can bypass via API

**How to Fix:**

#### A. Android Side - Integrate PaymentOverlay with OverlayManager

**File:** `android/MederPayEnforcerA/app/src/main/kotlin/com/mederpay/enforcera/EnforcementService.kt`

Change lines 219-249 from:
```kotlin
// Current weak implementation
val intent = Intent(this, PaymentOverlay::class.java)
startActivity(intent)
```

To:
```kotlin
// Use OverlayManager for non-dismissible enforcement
if (settlementStatus.is_overdue && !settlementStatus.is_paid) {
    OverlayManager.showOverlay(
        this,
        OverlayManager.OverlayType.SETTLEMENT_DUE,
        "Weekly Settlement Overdue",
        "Amount: ₦${settlementStatus.amount_due}. Operations blocked until paid.",
        mapOf(
            "settlement_id" to (settlementStatus.settlement_id ?: ""),
            "amount" to (settlementStatus.amount_due?.toString() ?: "0")
        )
    )
}
```

#### B. Backend Side - Add Settlement Check Middleware

**Create:** `backend/apps/payments/decorators.py`

```python
from functools import wraps
from django.core.exceptions import PermissionDenied
from django.utils import timezone
from apps.payments.monnify_models import WeeklySettlement


def require_settlement_paid(view_func):
    """
    Decorator to block inventory operations if agent has unpaid settlement
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if hasattr(request.user, 'agent_profile'):
            agent = request.user.agent_profile
            
            # Check for overdue settlements
            overdue = WeeklySettlement.objects.filter(
                agent=agent,
                status__in=['PENDING', 'PARTIAL'],
                due_date__lt=timezone.now()
            ).exists()
            
            if overdue:
                raise PermissionDenied(
                    "Settlement payment required. Please clear pending settlement."
                )
        
        return view_func(request, *args, **kwargs)
    return wrapper
```

**Update:** `backend/apps/agents/views.py`

Add the decorator to phone and sales endpoints:
```python
from apps.payments.decorators import require_settlement_paid

class PhoneViewSet(viewsets.ModelViewSet):
    @require_settlement_paid  # ADD THIS
    def create(self, request):
        # existing code...
        
class SaleViewSet(viewsets.ModelViewSet):
    @require_settlement_paid  # ADD THIS
    def create(self, request):
        # existing code...
```

**Test:**
```bash
# Try to create phone with unpaid settlement - should fail
curl -X POST http://localhost:8000/api/phones/ \
  -H "Authorization: Bearer <token>" \
  -d '{"imei": "123", "model": "iPhone"}' 
# Expected: 403 Forbidden - "Settlement payment required"
```

---

### 2. Security Hardening (3-4 days)

**Problem:** Apps can be bypassed by rooted users, USB debugging, or emulators.

**What's Wrong:**
- No root detection
- No anti-debugging
- No emulator detection
- Apps work fine on rooted devices

**How to Fix:**

#### Create Security Checker

**Create:** `android/MederPayEnforcerA/app/src/main/kotlin/com/mederpay/enforcera/SecurityChecker.kt`

```kotlin
package com.mederpay.enforcera

import android.content.Context
import android.content.pm.ApplicationInfo
import android.os.Build
import java.io.File

object SecurityChecker {
    
    /**
     * Check if device is rooted
     */
    fun isDeviceRooted(): Boolean {
        // Check for su binary
        val rootPaths = listOf(
            "/su/bin/su",
            "/system/xbin/su",
            "/system/bin/su",
            "/sbin/su",
            "/system/sd/xbin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/system/app/Superuser.apk",
            "/system/app/SuperSU.apk"
        )
        
        return rootPaths.any { File(it).exists() }
    }
    
    /**
     * Check if app is debuggable
     */
    fun isDebuggable(context: Context): Boolean {
        return (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
    }
    
    /**
     * Check if running in emulator
     */
    fun isEmulator(): Boolean {
        return (Build.FINGERPRINT.startsWith("generic")
                || Build.FINGERPRINT.startsWith("unknown")
                || Build.MODEL.contains("google_sdk")
                || Build.MODEL.contains("Emulator")
                || Build.MODEL.contains("Android SDK built for x86")
                || Build.MANUFACTURER.contains("Genymotion")
                || (Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic"))
                || "google_sdk" == Build.PRODUCT)
    }
    
    /**
     * Perform full security check
     */
    fun performSecurityCheck(context: Context): SecurityReport {
        return SecurityReport(
            isRooted = isDeviceRooted(),
            isDebuggable = isDebuggable(context),
            isEmulator = isEmulator()
        )
    }
}

data class SecurityReport(
    val isRooted: Boolean,
    val isDebuggable: Boolean,
    val isEmulator: Boolean
) {
    val isSecure: Boolean
        get() = !isRooted && !isDebuggable && !isEmulator
}
```

#### Integrate with EnforcementService

**Update:** `android/MederPayEnforcerA/app/src/main/kotlin/com/mederpay/enforcera/EnforcementService.kt`

Add security check at the start of `performEnforcementCheck()`:
```kotlin
private suspend fun performEnforcementCheck() {
    // ADD THIS - Security check first
    val securityReport = SecurityChecker.performSecurityCheck(this)
    
    if (!securityReport.isSecure) {
        val reason = when {
            securityReport.isRooted -> "Device is rooted"
            securityReport.isDebuggable -> "Debug mode enabled"
            securityReport.isEmulator -> "Running in emulator"
            else -> "Security check failed"
        }
        
        OverlayManager.showOverlay(
            this,
            OverlayManager.OverlayType.DEVICE_LOCKED,
            "Security Violation",
            "Device security compromised: $reason. Contact support."
        )
        
        logAuditEvent("security_violation", mapOf(
            "rooted" to securityReport.isRooted.toString(),
            "debuggable" to securityReport.isDebuggable.toString(),
            "emulator" to securityReport.isEmulator.toString()
        ))
        
        return  // Stop enforcement check
    }
    
    // ... rest of existing code
}
```

#### Backend Enforcement

**Update:** `backend/apps/enforcement/views.py`

Add security validation to health check endpoint:
```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_health_check(request):
    """Receive health check from Android device"""
    data = request.data
    
    # NEW: Check device security
    security_report = data.get('security_report', {})
    if security_report.get('is_rooted') or \
       security_report.get('is_debuggable') or \
       security_report.get('is_emulator'):
        
        # Mark device as compromised
        imei = data.get('imei')
        try:
            phone = Phone.objects.get(imei=imei)
            # You may want to add is_compromised field to Phone model
            
            # Return lock command
            return Response({
                'should_lock': True,
                'reason': 'Device security compromised',
                'balance': None
            })
        except Phone.DoesNotExist:
            pass
    
    # ... rest of existing code
```

**Test:**
- Install on rooted device → Should show security violation overlay
- Enable USB debugging → Should detect and block
- Run in emulator → Should detect and block

---

## 🔴 PRIORITY 1 - CRITICAL (Must Fix Before Full Launch)

### 3. Signature Verification (1 day)

**Problem:** Apps use "trust on first use" which allows attackers to install modified apps initially.

**How to Fix:**

**Update:** `android/build-dual-apps.sh`

Add signature extraction and embedding:
```bash
# After building APKs, extract signatures
echo "Extracting signatures..."
SIGNATURE_A=$(get_apk_signature "MederPayEnforcerA/app/build/outputs/apk/release/app-release.apk")
SIGNATURE_B=$(get_apk_signature "MederPayEnforcerB/app/build/outputs/apk/release/app-release.apk")

# Write to compile-time constants
echo "package com.mederpay.enforcera

object SecurityConstants {
    const val EXPECTED_COMPANION_SIGNATURE = \"$SIGNATURE_B\"
}" > MederPayEnforcerA/app/src/main/kotlin/com/mederpay/enforcera/SecurityConstants.kt

echo "package com.mederpay.enforcerb

object SecurityConstants {
    const val EXPECTED_COMPANION_SIGNATURE = \"$SIGNATURE_A\"
}" > MederPayEnforcerB/app/src/main/kotlin/com/mederpay/enforcerb/SecurityConstants.kt

# Rebuild with embedded signatures
echo "Rebuilding with embedded signatures..."
```

**Update:** `android/MederPayEnforcerA/app/src/main/kotlin/com/mederpay/enforcera/CompanionMonitor.kt`

Replace trust-on-first-use with compile-time check:
```kotlin
fun verifyCompanionSignature(context: Context): Boolean {
    val actualHash = computeSignatureHash(signatures[0].toByteArray())
    
    // Use compile-time constant instead of runtime storage
    return MessageDigest.isEqual(
        actualHash.toByteArray(),
        SecurityConstants.EXPECTED_COMPANION_SIGNATURE.toByteArray()
    )
}
```

---

### 4. Add Automated Tests (5-7 days)

**Problem:** Zero test files exist. Cannot validate changes or prevent regressions.

**How to Fix:**

#### Backend Tests

**Create:** `backend/pytest.ini`
```ini
[pytest]
DJANGO_SETTINGS_MODULE = config.settings.test
python_files = tests.py test_*.py *_tests.py
```

**Create:** `backend/apps/agents/tests/test_sale_constraints.py`
```python
import pytest
from django.db import IntegrityError
from apps.agents.models import Sale, Phone, Customer, AgentStaff
from apps.platform.models import Agent, User


@pytest.mark.django_db
class TestSaleConstraints:
    """Test one active sale per phone constraint"""
    
    def test_one_active_sale_per_phone(self, agent, phone, customer):
        """Cannot create two active sales for same phone"""
        # Create first active sale
        sale1 = Sale.objects.create(
            agent=agent,
            phone=phone,
            customer=customer,
            status='active',
            sale_price=1000,
            down_payment=300,
            total_payable=1000,
            balance_remaining=700
        )
        
        # Try to create second active sale - should fail
        with pytest.raises(IntegrityError, match='one_active_sale_per_phone'):
            Sale.objects.create(
                agent=agent,
                phone=phone,
                customer=customer,
                status='active',
                sale_price=1000,
                down_payment=0,
                total_payable=1000,
                balance_remaining=1000
            )
    
    def test_can_create_sale_after_completion(self, agent, phone, customer):
        """Can create new sale after completing previous one"""
        # Create and complete first sale
        sale1 = Sale.objects.create(
            agent=agent,
            phone=phone,
            customer=customer,
            status='active',
            sale_price=1000,
            down_payment=300,
            total_payable=1000,
            balance_remaining=700
        )
        
        sale1.status = 'completed'
        sale1.save()
        
        # Should be able to create new active sale
        sale2 = Sale.objects.create(
            agent=agent,
            phone=phone,
            customer=customer,
            status='active',
            sale_price=800,
            down_payment=200,
            total_payable=800,
            balance_remaining=600
        )
        
        assert sale2.id is not None
```

**Create:** `backend/apps/payments/tests/test_payment_record.py`
```python
import pytest
from decimal import Decimal
from apps.payments.models import PaymentRecord
from apps.agents.models import Sale


@pytest.mark.django_db
class TestPaymentRecord:
    """Test immutable payment audit trail"""
    
    def test_balance_tracking(self, sale):
        """Verify balance_before and balance_after are correct"""
        initial_balance = sale.balance_remaining
        payment_amount = Decimal('300.00')
        
        payment = PaymentRecord.objects.create(
            agent=sale.agent,
            sale=sale,
            amount=payment_amount,
            payment_method='cash',
            status='confirmed',
            balance_before=initial_balance,
            balance_after=initial_balance - payment_amount
        )
        
        assert payment.balance_before == initial_balance
        assert payment.balance_after == initial_balance - payment_amount
        assert payment.amount == payment_amount
```

**Run tests:**
```bash
cd backend
pip install pytest pytest-django pytest-cov
pytest
```

#### Android Tests

**Create:** `android/MederPayEnforcerA/app/src/test/kotlin/com/mederpay/enforcera/SecurityCheckerTest.kt`
```kotlin
package com.mederpay.enforcera

import org.junit.Test
import org.junit.Assert.*

class SecurityCheckerTest {
    
    @Test
    fun testIsDeviceRooted_DetectsSuBinary() {
        // This test runs on development machine
        // Root detection should return false on normal dev environment
        val isRooted = SecurityChecker.isDeviceRooted()
        assertFalse("Dev machine should not be detected as rooted", isRooted)
    }
    
    @Test
    fun testIsEmulator_DetectsEmulator() {
        // Should detect when running in emulator
        val isEmulator = SecurityChecker.isEmulator()
        // Will be true if running in CI/emulator
    }
}
```

**Add to:** `android/MederPayEnforcerA/app/build.gradle.kts`
```kotlin
dependencies {
    // Existing dependencies...
    
    // Add test dependencies
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.mockito:mockito-core:5.3.1")
    testImplementation("org.mockito.kotlin:mockito-kotlin:5.0.0")
}
```

---

### 5. Backend Settlement Enforcement (1 day)

**Already covered in Fix #1 - Part B above**

Just add the decorator to all inventory operations:
- `POST /api/phones/` - Phone registration
- `POST /api/sales/` - Sale creation
- `POST /api/customers/` - Customer creation
- `PATCH /api/phones/{id}/` - Phone updates

---

### 6. Audit Log Integration (1-2 days)

**Problem:** Logs are created locally but never sent to backend.

**How to Fix:**

#### Backend API Endpoint

**Create:** `backend/apps/enforcement/models.py` (add to existing file)
```python
class DeviceAuditLog(models.Model):
    """Audit events from Android enforcement apps"""
    log_id = models.CharField(max_length=255, unique=True, db_index=True)
    phone = models.ForeignKey(Phone, on_delete=models.CASCADE, related_name='audit_logs')
    event_type = models.CharField(max_length=100, db_index=True)
    timestamp = models.DateTimeField(db_index=True)
    metadata = models.JSONField(default=dict)
    received_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'device_audit_logs'
        indexes = [
            models.Index(fields=['phone', 'event_type']),
            models.Index(fields=['timestamp']),
        ]
```

**Add to:** `backend/apps/enforcement/views.py`
```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def receive_audit_logs(request):
    """
    Receive batch audit logs from Android apps
    
    POST /api/enforcement/audit-logs/
    Body: {
        "imei": "123...",
        "logs": [
            {
                "event_type": "device_admin_disabled",
                "timestamp": "2026-01-17T10:30:00Z",
                "data": {...}
            }
        ]
    }
    """
    imei = request.data.get('imei')
    logs = request.data.get('logs', [])
    
    try:
        phone = Phone.objects.get(imei=imei)
    except Phone.DoesNotExist:
        return Response({'error': 'Device not found'}, status=404)
    
    created_count = 0
    for log_entry in logs:
        # Deduplication
        log_id = f"{imei}:{log_entry['event_type']}:{log_entry['timestamp']}"
        
        if not DeviceAuditLog.objects.filter(log_id=log_id).exists():
            DeviceAuditLog.objects.create(
                log_id=log_id,
                phone=phone,
                event_type=log_entry['event_type'],
                timestamp=log_entry['timestamp'],
                metadata=log_entry.get('data', {})
            )
            created_count += 1
    
    return Response({
        'received': len(logs),
        'created': created_count
    })
```

#### Android Implementation

**Update:** `android/MederPayEnforcerA/app/src/main/kotlin/com/mederpay/enforcera/AuditLogger.kt`

Complete the implementation:
```kotlin
object AuditLogger {
    private const val TAG = "AuditLogger"
    private const val QUEUE_FILE = "audit_log_queue.json"
    
    fun logEvent(context: Context, imei: String, eventType: String, data: Map<String, String>) {
        val logEntry = AuditLogEntry(
            event_type = eventType,
            timestamp = System.currentTimeMillis(),
            data = data
        )
        
        // Try immediate send
        CoroutineScope(Dispatchers.IO).launch {
            val sent = sendLogToBackend(context, imei, logEntry)
            
            if (!sent) {
                // Queue for later
                queueLog(context, logEntry)
            }
        }
    }
    
    suspend fun sendLogToBackend(
        context: Context,
        imei: String,
        logEntry: AuditLogEntry
    ): Boolean {
        return try {
            ApiClient.service.sendAuditLog(imei, logEntry)
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send audit log", e)
            false
        }
    }
    
    suspend fun processQueuedLogs(context: Context) {
        val queue = getQueuedLogs(context)
        if (queue.isEmpty()) return
        
        val imei = getDeviceImei(context)
        
        try {
            val response = ApiClient.service.sendAuditLogBatch(
                imei,
                BatchAuditLogsRequest(logs = queue)
            )
            
            // Remove successfully sent logs
            if (response.created > 0) {
                clearQueue(context, response.created)
            }
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to process queued logs", e)
        }
    }
    
    private fun queueLog(context: Context, logEntry: AuditLogEntry) {
        // Implement queue persistence to SharedPreferences or file
        val prefs = context.getSharedPreferences("audit_logs", Context.MODE_PRIVATE)
        val queue = getQueuedLogs(context).toMutableList()
        queue.add(logEntry)
        
        // Keep only last 100 logs
        if (queue.size > 100) {
            queue.removeAt(0)
        }
        
        // Save to SharedPreferences
        val json = Gson().toJson(queue)
        prefs.edit().putString("queue", json).apply()
    }
}
```

**Add to:** `android/MederPayEnforcerA/app/src/main/kotlin/com/mederpay/enforcera/ApiClient.kt`
```kotlin
interface ApiService {
    // Existing endpoints...
    
    @POST("enforcement/audit-logs/")
    suspend fun sendAuditLogBatch(
        @Query("imei") imei: String,
        @Body request: BatchAuditLogsRequest
    ): AuditLogResponse
}

data class BatchAuditLogsRequest(
    val logs: List<AuditLogEntry>
)

data class AuditLogResponse(
    val received: Int,
    val created: Int
)
```

---

## 📋 TESTING CHECKLIST

After implementing fixes, test these scenarios:

### Settlement Enforcement
- [ ] Create phone with unpaid settlement → Should fail with 403
- [ ] Pay settlement → Should allow phone creation
- [ ] Android app shows non-dismissible overlay for overdue settlement
- [ ] Pressing home doesn't dismiss settlement overlay

### Security Hardening
- [ ] Install on rooted device → Shows security violation
- [ ] Enable USB debugging → Detects and blocks
- [ ] Run in emulator → Detects and blocks
- [ ] Normal device → Works properly

### Signature Verification
- [ ] Install modified companion app → Detects tamper
- [ ] Install genuine companion app → Accepts

### Tests
- [ ] Run `pytest` → All tests pass
- [ ] Run `./gradlew test` → All Android tests pass

### Audit Logs
- [ ] Trigger device admin disable → Log sent to backend
- [ ] Check backend `/api/enforcement/audit-logs/` → Logs appear
- [ ] View logs in Django admin → Events visible

---

## 🎯 PRIORITY ORDER

**Week 1 (Critical Path):**
1. Fix #1 - Settlement enforcement (both Android & backend)
2. Fix #5 - Backend settlement enforcement decorator
3. Test end-to-end settlement flow

**Week 2 (Security & Quality):**
4. Fix #2 - Security hardening
5. Fix #3 - Signature verification
6. Fix #6 - Audit log integration
7. Fix #4 - Start adding tests (critical tests first)

**Week 3 (Polish):**
8. Complete test coverage (aim for 60%)
9. Add monitoring (Sentry)
10. Documentation updates
11. Final end-to-end testing

---

## 📚 ADDITIONAL RESOURCES

- **Full Audit Report:** [ENTERPRISE_AUDIT_REPORT.md](ENTERPRISE_AUDIT_REPORT.md) - 1,363 lines with detailed analysis
- **Executive Summary:** [AUDIT_EXECUTIVE_SUMMARY.md](AUDIT_EXECUTIVE_SUMMARY.md) - Quick reference

---

## ❓ QUESTIONS?

If you need help with any specific fix:
1. Read the detailed section in [ENTERPRISE_AUDIT_REPORT.md](ENTERPRISE_AUDIT_REPORT.md)
2. Look for code examples in the Critical Risks section
3. Each fix has "Current Code" and "Required Fix" examples

**Estimated total time: 2-3 weeks for production readiness**

**Current score: 6.5/10 → Target after fixes: 8.0+/10**
