# What's Next - Production Readiness Roadmap

**Date:** January 17, 2026  
**Current Status:** Security Hardening Complete ✅  
**Overall Progress:** ~70% (was 65%, now 70% after security implementation)  
**Target:** 100% Production Ready

---

## 📊 CURRENT STATE

### ✅ Completed (P0 Security)
- **Android 15+ Security Hardening** - Root/emulator/debug detection ✅
- **Backend Settlement Enforcement** - API bypass prevention ✅
- **Comprehensive Audit Report** - Full assessment complete ✅

### ⏳ Remaining Critical Items

**Priority 0 (Blocking - Must complete for ANY launch):**
- ❌ **Payment Settlement Overlay Integration** - Settlement checks exist but overlay isn't properly non-dismissible
- ❌ **Build Embedded APKs** - Self-healing recovery needs APK files embedded

**Priority 1 (Critical - Must complete before full production):**
- ❌ **Automated Tests** - Zero test coverage
- ❌ **Signature Verification Enhancement** - Currently trust-on-first-use
- ❌ **Audit Log Backend Integration** - Logs created but not transmitted
- ⚠️ **Payment Settlement Flow End-to-End** - Needs testing with Monnify

---

## 🎯 RECOMMENDED NEXT STEPS

### Week 1: Complete P0 Items (Critical Path)

#### Day 1-2: Payment Settlement Overlay Integration
**What:** Make settlement enforcement truly non-dismissible via OverlayManager

**Files to Modify:**
```kotlin
// android/MederPayEnforcerA/.../EnforcementService.kt
private suspend fun checkWeeklySettlement(imei: String) {
    val settlementStatus = ApiClient.service.getWeeklySettlement(imei)
    
    if (settlementStatus.is_overdue && !settlementStatus.is_paid) {
        // Use OverlayManager instead of PaymentOverlay activity
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
}
```

**Test:**
1. Create overdue settlement in backend
2. Launch App A on device
3. Verify overlay shows and cannot be dismissed
4. Pay settlement via Monnify
5. Verify overlay dismisses automatically

**Time:** 2 days  
**Priority:** P0 - BLOCKING

---

#### Day 3: Build Embedded APKs
**What:** Run build script to embed APKs for self-healing recovery

**Commands:**
```bash
cd android
./build-dual-apps.sh release
```

**What This Does:**
1. Builds App A release APK
2. Embeds App B APK into App A assets
3. Builds App B release APK
4. Embeds App A APK into App B assets
5. Rebuilds both with embedded companions

**Test:**
1. Install App A
2. Uninstall App B
3. Verify App A triggers recovery and reinstalls App B
4. Repeat in reverse

**Time:** 1 day (including testing)  
**Priority:** P0 - BLOCKING

---

### Week 2: Complete P1 Items (Quality & Security)

#### Day 4-6: Automated Tests (Foundation)
**What:** Add critical test coverage (target: 40% minimum)

**Backend Tests to Create:**

**1. Database Constraint Tests**
```python
# backend/apps/agents/tests/test_sale_constraints.py
import pytest
from django.db import IntegrityError

@pytest.mark.django_db
def test_one_active_sale_per_phone():
    """Cannot create two active sales for same phone"""
    sale1 = Sale.objects.create(phone=phone, status='active', ...)
    
    with pytest.raises(IntegrityError, match='one_active_sale_per_phone'):
        Sale.objects.create(phone=phone, status='active', ...)
```

**2. Settlement Enforcement Tests**
```python
# backend/apps/payments/tests/test_decorators.py
def test_require_settlement_paid_blocks_when_overdue():
    """Decorator blocks operations with overdue settlement"""
    # Create overdue settlement
    settlement = WeeklySettlement.objects.create(
        agent=agent, status='PENDING', due_date=yesterday
    )
    
    # Try to create phone
    response = client.post('/api/phones/', data, headers=auth)
    assert response.status_code == 403
    assert 'Settlement payment required' in response.json()['error']
```

**Android Tests to Create:**

**1. SecurityChecker Tests**
```kotlin
// android/MederPayEnforcerA/.../SecurityCheckerTest.kt
@Test
fun testRootDetection() {
    val isRooted = SecurityChecker.isDeviceRooted()
    // On dev machine should be false
    assertFalse(isRooted)
}

@Test
fun testSecurityReport() {
    val report = SecurityChecker.performSecurityCheck(mockContext)
    assertNotNull(report)
    assertEquals(Build.VERSION.SDK_INT, report.androidVersion)
}
```

**Setup Required:**
```bash
# Backend
cd backend
pip install pytest pytest-django pytest-cov
pytest

# Android
cd android/MederPayEnforcerA
./gradlew test
```

**Time:** 3 days  
**Priority:** P1 - CRITICAL (prevents regressions)

---

#### Day 7-8: Signature Verification Enhancement
**What:** Replace trust-on-first-use with compile-time signature pinning

**Current Problem:**
```kotlin
// CompanionMonitor.kt - WEAK
if (expectedHash.isNullOrEmpty()) {
    // First time - store (TRUST ON FIRST USE - VULNERABLE!)
    SecureStorage.storeCompanionSignatureHash(context, actualHash)
    return true
}
```

**Fix Required:**

**1. Extract Signatures at Build Time**
```bash
# android/build-dual-apps.sh - ADD THIS
get_apk_signature() {
    local apk=$1
    keytool -printcert -jarfile "$apk" | grep "SHA256:" | cut -d: -f2 | tr -d ' '
}

SIGNATURE_A=$(get_apk_signature "app-a-release.apk")
SIGNATURE_B=$(get_apk_signature "app-b-release.apk")

# Embed in compile-time constants
echo "const val EXPECTED_SIGNATURE = \"$SIGNATURE_B\"" > \
    MederPayEnforcerA/.../SecurityConstants.kt
echo "const val EXPECTED_SIGNATURE = \"$SIGNATURE_A\"" > \
    MederPayEnforcerB/.../SecurityConstants.kt
```

**2. Use Constant in Verification**
```kotlin
// CompanionMonitor.kt - STRONG
fun verifyCompanionSignature(context: Context): Boolean {
    val actualHash = computeSignatureHash(signatures[0].toByteArray())
    
    // Use compile-time constant (no trust-on-first-use)
    return MessageDigest.isEqual(
        actualHash.toByteArray(),
        SecurityConstants.EXPECTED_SIGNATURE.toByteArray()
    )
}
```

**Time:** 2 days  
**Priority:** P1 - HIGH (security improvement)

---

#### Day 9-10: Audit Log Backend Integration
**What:** Complete transmission of audit logs to backend

**Current Problem:**
```kotlin
// AuditLogger.kt - LOGS LOCALLY ONLY
fun logEvent(context: Context, imei: String, eventType: String, data: Map<String, String>) {
    Log.i(TAG, "Audit: $eventType")
    // TODO: Send to backend - NOT IMPLEMENTED
}
```

**Fix Required:**

**1. Backend Endpoint**
```python
# backend/apps/enforcement/models.py - ADD
class DeviceAuditLog(models.Model):
    log_id = models.CharField(max_length=255, unique=True)
    phone = models.ForeignKey(Phone, on_delete=models.CASCADE)
    event_type = models.CharField(max_length=100)
    timestamp = models.DateTimeField()
    metadata = models.JSONField(default=dict)

# backend/apps/enforcement/views.py - ADD
@api_view(['POST'])
def receive_audit_logs(request):
    imei = request.data.get('imei')
    logs = request.data.get('logs', [])
    
    for log_entry in logs:
        DeviceAuditLog.objects.create(
            log_id=f"{imei}:{log_entry['event_type']}:{log_entry['timestamp']}",
            phone=phone,
            event_type=log_entry['event_type'],
            timestamp=log_entry['timestamp'],
            metadata=log_entry.get('data', {})
        )
    
    return Response({'received': len(logs)})
```

**2. Android Implementation**
```kotlin
// AuditLogger.kt - COMPLETE
suspend fun sendLogToBackend(context: Context, imei: String, logEntry: AuditLogEntry): Boolean {
    return try {
        ApiClient.service.sendAuditLog(imei, logEntry)
        true
    } catch (e: Exception) {
        queueLog(context, logEntry)  // Queue for retry
        false
    }
}
```

**Time:** 2 days  
**Priority:** P1 - IMPORTANT (compliance & debugging)

---

### Week 3: Testing & Polish

#### Day 11-13: End-to-End Testing
**What:** Test complete flows on physical devices

**Test Scenarios:**

1. **Settlement Enforcement Flow**
   - Create overdue settlement
   - Launch app → Verify overlay shows
   - Make payment via Monnify
   - Verify overlay dismisses
   - Verify backend decorator allows operations

2. **Security Violation Flow**
   - Install on rooted device → Verify blocked
   - Install on emulator → Verify blocked
   - Install on normal device → Verify works

3. **Companion Recovery Flow**
   - Install both apps
   - Uninstall App B
   - Verify App A detects and triggers recovery
   - Verify App B reinstalls

4. **Payment Flow (Customer)**
   - Create sale
   - Make partial payment
   - Verify installment tracking
   - Complete payment
   - Verify device unlock

**Time:** 3 days  
**Priority:** P1 - ESSENTIAL (validation)

---

#### Day 14-15: Monitoring & Documentation
**What:** Add production monitoring and update docs

**1. Add Sentry Monitoring**
```python
# backend/config/settings/production.py
import sentry_sdk

sentry_sdk.init(
    dsn=os.environ.get('SENTRY_DSN'),
    traces_sample_rate=0.1,
    environment='production',
)
```

**2. Update Documentation**
- Deployment guide with new security features
- Testing guide for QA team
- Troubleshooting guide for support
- API documentation updates

**Time:** 2 days  
**Priority:** P2 - IMPORTANT (operations)

---

## 📋 QUICK CHECKLIST

Copy this checklist to track progress:

### Priority 0 (This Week)
- [ ] Day 1-2: Fix settlement overlay integration
- [ ] Day 3: Build embedded APKs and test recovery
- [ ] Day 3: End-to-end test settlement flow

### Priority 1 (Next 2 Weeks)
- [ ] Day 4-6: Add automated tests (40% coverage minimum)
- [ ] Day 7-8: Enhance signature verification
- [ ] Day 9-10: Complete audit log integration
- [ ] Day 11-13: End-to-end testing on physical devices
- [ ] Day 14-15: Add monitoring and update docs

### Priority 2 (Before Launch)
- [ ] Performance testing (100+ agents)
- [ ] Security penetration testing
- [ ] Backup & disaster recovery setup
- [ ] Beta user recruitment

---

## 🎯 MILESTONES

### Milestone 1: MVP Ready (End of Week 1)
**Criteria:**
- ✅ Security hardening complete
- ✅ Settlement enforcement works end-to-end
- ✅ Self-healing recovery functional
- ✅ Can handle 10 test agents

**Status:** Ready for internal testing

---

### Milestone 2: Beta Ready (End of Week 3)
**Criteria:**
- ✅ All P0 + P1 items complete
- ✅ 40%+ test coverage
- ✅ Tested on 5+ device models
- ✅ Monitoring in place
- ✅ Can handle 50 beta agents

**Status:** Ready for limited beta launch

---

### Milestone 3: Production Ready (Week 4-5)
**Criteria:**
- ✅ 60%+ test coverage
- ✅ Security audit passed
- ✅ Performance tested (100+ agents)
- ✅ Backup/recovery tested
- ✅ Documentation complete

**Status:** Ready for full production launch

---

## 📊 PROGRESS TRACKING

### Current Score: 7.0/10 (was 6.5/10)
**Breakdown:**
- Architecture: 8/10 ✅
- Data Model: 9/10 ✅
- Security: 8/10 ✅ (was 7/10, improved with Android 15+ hardening)
- Code Quality: 8/10 ✅
- Completeness: 6/10 ⚠️ (was 5/10, improved to 6/10)
- Testing: 2/10 ❌
- Scalability: 6/10 ✅
- Operational: 5/10 ⚠️ (was 4/10, improved with decorators)

**Target Score: 8.0+/10**

### To Reach 8.0+:
1. Complete P0 items: +0.3 points → 7.3/10
2. Add tests (40%): +0.4 points → 7.7/10
3. Complete P1 items: +0.3 points → 8.0/10

---

## 🚀 DEPLOYMENT STRATEGY

### Option 1: Phased Rollout (RECOMMENDED)
**Week 3:** Internal testing (5 staff members)  
**Week 4:** Closed beta (10 trusted agents)  
**Week 5:** Open beta (50 agents)  
**Week 6:** Gradual production (100 → 500 → full)

### Option 2: Direct to Beta
**Week 3:** Complete all P0+P1 items  
**Week 4:** Beta launch (50 agents immediately)  
**Week 5:** Production launch

---

## ⚠️ KNOWN RISKS & MITIGATIONS

### Risk 1: Settlement Payment Integration Issues
**Probability:** Medium  
**Impact:** High  
**Mitigation:** Test with Monnify sandbox extensively before production

### Risk 2: Self-Healing Recovery on Different OEMs
**Probability:** Medium  
**Impact:** Medium  
**Mitigation:** Test on Tecno, Infinix, Samsung, Xiaomi devices

### Risk 3: Insufficient Test Coverage
**Probability:** High  
**Impact:** High  
**Mitigation:** Focus on critical paths first (settlement, payment, security)

---

## 💡 RECOMMENDATIONS

### Immediate Action (Today/Tomorrow)
1. **Start with settlement overlay integration** - This is the most critical user-facing feature
2. **Test on physical Android 15 device** - Verify security checks work correctly
3. **Run build-dual-apps.sh** - Get embedded APKs ready

### This Week
1. Complete all P0 items
2. Begin test infrastructure setup
3. Document deployment process

### Next Week
1. Complete P1 items
2. Extensive device testing
3. Prepare for beta launch

---

## 📞 SUPPORT & RESOURCES

### Documentation
- **Audit Report:** ENTERPRISE_AUDIT_REPORT.md (complete analysis)
- **Quick Fixes:** FIXES_REQUIRED.md (implementation guide)
- **Security:** ANDROID15_HARDENING_IMPLEMENTED.md (what's done)
- **This Document:** WHATS_NEXT.md (roadmap)

### Testing Resources
- Android Studio Emulator (API 35 for Android 15)
- Physical devices needed: Samsung, Xiaomi, Tecno, Infinix
- Monnify sandbox account for payment testing

### Questions?
Refer to FIXES_REQUIRED.md for detailed code examples of each remaining fix.

---

## ✅ SUCCESS CRITERIA

**You're ready for beta when:**
- [ ] Settlement overlay is truly non-dismissible
- [ ] Self-healing recovery works on real devices
- [ ] Security checks block rooted/emulator devices
- [ ] Backend enforcement prevents API bypass
- [ ] Critical tests pass (settlement, payment, security)
- [ ] Tested on 3+ different device models

**You're ready for production when:**
- [ ] All P0 + P1 items complete
- [ ] 40%+ test coverage
- [ ] Tested on 5+ device models
- [ ] Monitoring and alerting active
- [ ] Backup/recovery tested
- [ ] Beta ran successfully for 2+ weeks

---

**Current Status:** Ready to proceed with Week 1 tasks  
**Recommended Start:** Settlement overlay integration  
**Estimated Time to Beta:** 2-3 weeks  
**Estimated Time to Production:** 3-4 weeks

---

**Next Action:** Begin settlement overlay integration (see Day 1-2 above)
