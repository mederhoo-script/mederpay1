# Beyond Building: Complete Production Readiness Checklist

**Date:** January 17, 2026  
**Question:** "Apart from building what else does the app needs"  
**Context:** Week 1 P0 implementation in progress

---

## 📊 CURRENT STATUS SUMMARY

**Overall Completion:** 78%  
**What's Built:** ✅ Architecture, security hardening, backend enforcement  
**What's Missing:** Testing, monitoring, deployment readiness

---

## 🎯 WHAT THE APP NEEDS BEYOND BUILDING

### 1. ✅ ALREADY COMPLETE (Don't Need to Do Again)

**Security Hardening:**
- ✅ Android 15+ root detection (Magisk, KernelSU)
- ✅ Emulator detection
- ✅ Debug mode detection
- ✅ Backend settlement enforcement decorator
- ✅ Settlement overlay integration (OverlayManager)

**Score Impact:** Security 7.0/10 ✅

---

### 2. ⏳ PENDING P0 ITEMS (Must Do Before ANY Launch)

#### A. Build Embedded APKs 📋 **DOCUMENTED - READY TO EXECUTE**

**Status:** Build script exists, documentation complete, needs execution

**What:** Run the build script to create APKs with mutual recovery

**Command:**
```bash
cd android
./build-dual-apps.sh release
```

**Time:** 15-20 minutes  
**Blocker:** Requires Android SDK (API 35, JDK 17, Gradle 8.0+)

**Why It Matters:**
- Enables self-healing recovery between App A & B
- If user uninstalls one app, the other can reinstall it
- Critical for enforcement reliability

**Testing Needed:**
- Test recovery on physical devices
- Verify on multiple OEMs (Samsung, Xiaomi, Tecno)
- Confirm embedded APKs work correctly

---

### 3. 🔴 CRITICAL P1 ITEMS (Must Do Before Full Production)

#### A. Automated Tests ❌ **NEEDED**

**Status:** Only 6 backend tests exist, no Android tests

**What's Needed:**

**Backend Tests (pytest):**
```python
# Settlement enforcement tests ✅ Already created
backend/apps/payments/tests/test_decorators.py

# STILL NEEDED:
- Phone lifecycle tests (in_stock → sold → defaulted)
- Sale constraint tests (one active sale per phone)
- Customer payment tests
- Audit log tests
- API permission tests
```

**Android Tests (JUnit):**
```kotlin
// NEEDED:
android/.../tests/
- SecurityCheckerTest.kt (root/emulator detection)
- CompanionMonitorTest.kt (mutual monitoring)
- EnforcementServiceTest.kt (enforcement flows)
- RecoveryInstallerTest.kt (APK extraction)
```

**Target:** 40% code coverage minimum  
**Time:** 5-7 days  
**Priority:** P1 - Critical

**Why It Matters:**
- Can't validate correctness without tests
- Prevents regressions when making changes
- Required for production confidence

---

#### B. Signature Verification Enhancement ❌ **NEEDED**

**Status:** Currently uses trust-on-first-use (TOFU) - vulnerable on first install

**What's Wrong:**
```kotlin
// Current: Signature stored at runtime (WEAK)
val companionSignature = getSignature(companionPackage)
prefs.putString("companion_signature", companionSignature)

// Problem: First install is vulnerable to compromised APK
```

**What's Needed:**
```kotlin
// Compile-time signature pinning (STRONG)
object SignaturePins {
    const val APP_A_SIGNATURE = "30820..." // Embedded at compile time
    const val APP_B_SIGNATURE = "30821..." // Cannot be changed at runtime
    
    fun verifySignature(context: Context, packageName: String): Boolean {
        val actualSignature = getSignature(packageName)
        val expectedSignature = when(packageName) {
            "com.mederpay.enforcera" -> APP_A_SIGNATURE
            "com.mederpay.enforcerb" -> APP_B_SIGNATURE
            else -> return false
        }
        
        return constantTimeCompare(actualSignature, expectedSignature)
    }
}
```

**How to Implement:**
1. Extract signatures from built APKs
2. Embed in build script
3. Update CompanionMonitor to use pinned signatures
4. Use constant-time comparison (prevent timing attacks)

**Time:** 1-2 days  
**Priority:** P1 - Security

**Why It Matters:**
- Prevents initial installation attacks
- Blocks sophisticated attackers from compromising first install
- Big-Tech standard practice

---

#### C. Audit Log Backend Integration ❌ **NEEDED**

**Status:** Android creates logs, but doesn't transmit to backend

**What's Working:**
```kotlin
// Android side: AuditLogger.kt exists ✅
AuditLogger.log(
    event = "settlement_enforcement_triggered",
    data = mapOf("amount" to "5000")
)
```

**What's Missing:**
```python
# Backend API endpoint DOESN'T EXIST ❌
POST /api/audit-logs/
{
    "device_id": "...",
    "event": "settlement_enforcement_triggered",
    "timestamp": "2026-01-17T12:00:00Z",
    "data": {...}
}
```

**What's Needed:**

**Backend (Django):**
```python
# Create: backend/apps/audit/views.py
class AuditLogViewSet(viewsets.ModelViewSet):
    def create(self, request):
        # Receive audit logs from Android
        # Store in database
        # Return acknowledgment
```

**Android:**
```kotlin
// Update: AuditLogger.kt
fun uploadPendingLogs() {
    val logs = database.getPendingLogs()
    
    // Batch upload with retry
    ApiClient.service.uploadAuditLogs(logs)
    
    // Mark as uploaded
    database.markUploaded(logs)
}
```

**Time:** 1-2 days  
**Priority:** P1 - Operations

**Why It Matters:**
- Can't debug production issues without logs
- Can't investigate disputes without audit trail
- Can't detect tampering attempts

---

### 4. 🟡 IMPORTANT BUT NOT BLOCKING (Can Do After Launch)

#### A. Monitoring & Alerting 🔶 **RECOMMENDED**

**What's Needed:**

**Sentry Integration:**
```python
# backend/settings.py
import sentry_sdk

sentry_sdk.init(
    dsn="https://...@sentry.io/...",
    traces_sample_rate=1.0
)
```

```kotlin
// Android: build.gradle.kts
dependencies {
    implementation("io.sentry:sentry-android:6.x.x")
}
```

**Alerts to Set Up:**
- High error rate (> 5% of requests)
- Settlement enforcement failures
- Security violation detections
- APK recovery failures
- Payment webhook failures

**Time:** 1 day  
**Priority:** P2 - Operations

---

#### B. Performance Optimization 🔶 **RECOMMENDED**

**Database Indexes:**
```python
# Already good ✅ (db_index=True on key fields)
# Phone.imei, Sale.phone, Settlement.agent
```

**Caching:**
```python
# Add Redis for settlement status
from django.core.cache import cache

def check_settlement_status(agent):
    cache_key = f"settlement_status:{agent.id}"
    status = cache.get(cache_key)
    
    if not status:
        status = WeeklySettlement.objects.filter(
            agent=agent, status='PENDING'
        ).exists()
        cache.set(cache_key, status, timeout=300)  # 5 min
    
    return status
```

**Time:** 1-2 days  
**Priority:** P2 - Scale

---

#### C. Production Deployment Setup 🔶 **RECOMMENDED**

**What's Needed:**

**1. Environment Configuration:**
```bash
# Production settings
DEBUG=False
ALLOWED_HOSTS=api.mederpay.com
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SECRET_KEY=<strong-random-key>
```

**2. HTTPS/SSL Setup:**
- SSL certificate for API domain
- Certificate pinning in Android (optional but recommended)

**3. Database Backups:**
```bash
# Automated daily backups
pg_dump mederpay_production > backup_$(date +%Y%m%d).sql
```

**4. Load Balancer:**
- Configure for 10+ concurrent agents
- Health checks on `/health/`

**Time:** 2-3 days  
**Priority:** P2 - Production

---

### 5. 📱 DEPLOYMENT REQUIREMENTS

#### A. Google Play Store Preparation 🔶 **NEEDED FOR DISTRIBUTION**

**What's Required:**

**1. App Signing:**
```bash
# Generate upload key
keytool -genkey -v \
  -keystore upload-key.keystore \
  -alias upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

**2. App Bundle:**
```bash
# Build AAB instead of APK
./gradlew bundleRelease
```

**3. Store Listing:**
- App icon (512x512 PNG)
- Screenshots (6-8 images)
- Feature graphic (1024x500)
- Privacy policy URL
- App description
- Category: Finance/Business

**4. Play Store Review:**
- Device Admin permissions justification
- Overlay permissions justification
- Location permissions justification (if used)

**Time:** 3-5 days  
**Priority:** Required for public launch

---

#### B. APK Distribution (Direct Install) 🔶 **ALTERNATIVE**

**What's Needed:**

**1. Signed APKs:**
```bash
# Release builds with production keystore
./build-dual-apps.sh release
```

**2. Distribution Method:**
- Secure download link
- SMS with download URL
- WhatsApp distribution
- Agent portal download

**3. Installation Instructions:**
- Enable "Install from Unknown Sources"
- Grant all required permissions
- Complete onboarding wizard

**Time:** 1 day  
**Priority:** Can launch immediately with this

---

## 🎯 PRIORITIZED ACTION PLAN

### Week 1 (MVP) - Critical Path ⏰

**Must Do:**
1. ✅ Settlement overlay integration - DONE
2. 📋 Build embedded APKs (15-20 min) - READY TO EXECUTE
3. Test on 1-2 physical devices

**Result:** Can launch limited MVP to 10 test agents

---

### Week 2 (Beta Ready) - Quality & Security 🔒

**Must Do:**
1. Add automated tests (40% coverage) - 5-7 days
2. Enhance signature verification - 1-2 days
3. Complete audit log integration - 1-2 days

**Result:** Can launch beta to 50 agents

---

### Week 3 (Production Ready) - Polish 🚀

**Should Do:**
1. Add monitoring (Sentry) - 1 day
2. Performance optimization - 1-2 days
3. Production deployment setup - 2-3 days
4. End-to-end device testing - 2-3 days

**Result:** Can launch full production

---

### Week 4-5 (Distribution) - Launch 📱

**Must Do:**
1. Prepare Play Store listing - 3-5 days
2. OR Set up direct APK distribution - 1 day
3. Create user documentation - 2 days
4. Train support team - 1 day

**Result:** Public launch ready

---

## 📋 IMMEDIATE NEXT STEPS (This Week)

### Option 1: Continue Week 1 P0 (RECOMMENDED) ✅

**If you have Android SDK:**
```bash
cd android
./build-dual-apps.sh release
# Then test on physical devices
```

**Result:** Week 1 complete (MVP ready)

---

### Option 2: Start Week 2 P1 (ALTERNATIVE) ⚡

**If you DON'T have Android SDK:**
```bash
# Start adding automated tests
cd backend
pytest apps/payments/tests/ -v

# Create more tests
# - apps/agents/tests/test_phones.py
# - apps/agents/tests/test_sales.py
```

**Result:** Progress on P1 while waiting for SDK

---

## ✅ COMPLETION CHECKLIST

### P0 - Launch Blockers
- [x] Security hardening (Android 15+)
- [x] Backend settlement enforcement
- [x] Settlement overlay integration
- [ ] Build embedded APKs (documented, pending execution)

### P1 - Production Critical
- [x] Test infrastructure started (6 tests)
- [ ] Automated tests (40% coverage target)
- [ ] Signature verification enhanced
- [ ] Audit log backend integration

### P2 - Production Polish
- [ ] Monitoring (Sentry)
- [ ] Performance optimization
- [ ] Production deployment setup
- [ ] Documentation complete

### Distribution
- [ ] Play Store listing OR
- [ ] Direct APK distribution setup

---

## 📊 SCORE IMPACT

**Current:** 78% complete, 7.0/10 score

**After P0 (APK build):** 80% complete, 7.3/10 score  
**After P1 (tests, signature, logs):** 85% complete, 7.7/10 score  
**After P2 (monitoring, optimization):** 90% complete, 8.0/10 score  
**After Distribution (launch ready):** 95% complete, 8.5/10 score

---

## 🎯 BOTTOM LINE

**What the app needs beyond building:**

1. **Immediate (Week 1):** Build embedded APKs, test on devices
2. **Critical (Week 2):** Automated tests, signature pinning, audit logs
3. **Important (Week 3):** Monitoring, optimization, deployment
4. **Distribution (Week 4):** Play Store OR direct distribution

**Current Blocker:** Android SDK needed for APK build

**Alternative Path:** Start P1 tests while waiting for SDK

**Timeline:** 2-3 weeks to production-ready, 3-4 weeks to launch-ready

---

**Status:** Ready to proceed with either Week 1 completion OR Week 2 P1 items  
**Recommendation:** Build APKs if SDK available, otherwise start automated tests
