# MederPay - Full-Stack Agent Management Platform

A comprehensive enterprise-grade platform for managing phone sales with tamper-proof enforcement and payment tracking.

## ⚠️ Implementation Status

**Android Phase 1 Status:** ~65% Complete

The core security architecture is fully operational, but critical business features remain incomplete. See detailed assessments:
- 📊 **[QUICK_STATUS.md](QUICK_STATUS.md)** - Quick overview and verdict
- 📋 **[IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md)** - Visual checklist with metrics
- 📄 **[PHASE1_COMPLETION_STATUS.md](PHASE1_COMPLETION_STATUS.md)** - Comprehensive assessment
- 📖 **[IMPLEMENTATION_ASSESSMENT.md](IMPLEMENTATION_ASSESSMENT.md)** - Original detailed analysis

**Key Gaps:**
- ❌ Payment settlement enforcement NOT implemented (0%)
- ⚠️ Embedded APKs need to be built (run `android/build-dual-apps.sh`)
- ⚠️ Several integration and hardening tasks remain

**Estimated time to Phase 1 completion:** 5-7 business days

## 🏗️ Architecture

This platform consists of three integrated tiers:

1. **Django Backend** - REST API with business rules enforcement
2. **Android Enforcement Apps** (App A + App B) - Dual-app tamper-resistant architecture
3. **Next.js Web Platform** - SSR/PWA agent management dashboard

## 📋 Features

### Backend (Django)
- ✅ Complete REST API with JWT authentication
- ✅ PostgreSQL database with proper indexes and constraints
- ✅ Role-based access control (Platform Admin, Agent Owner, Sub-Agent)
- ✅ Business rules enforcement at backend level
- ✅ One active sale per phone constraint
- ✅ Payment balance tracking and reconciliation
- ✅ Monnify payment integration with webhook handlers
- ✅ Device command enforcement API
- ✅ Full audit logging (platform + agent levels)
- ✅ Automatic device unlock on payment completion
- ✅ IMEI blacklist management

### Android Apps (App A & App B) - ⚠️ ~65% Complete
- ✅ Dual-app mirrored architecture for tamper resistance
- ✅ Device Admin API enforcement
- ✅ Non-dismissible overlay for violations
- ✅ Mutual health monitoring between apps
- ❌ **Weekly payment settlement enforcement (NOT IMPLEMENTED)**
- ⚠️ Partial backend sync (needs audit logging)
- ✅ Foreground services with proper notifications
- ✅ Boot-time enforcement activation
- ✅ Support for Android 12+ (SDK 31-35)
- ⚠️ Self-healing recovery (needs APK embedding)

### Frontend (Next.js)
- ✅ Next.js 14 with App Router
- ✅ Server-side rendering (SSR)
- ✅ TailwindCSS responsive UI
- ✅ JWT authentication with auto-refresh
- ✅ Agent dashboard with statistics
- ✅ Phone inventory management
- ✅ Sales tracking and management
- ✅ Staff management
- ✅ Customer management
- ✅ Payment tracking and reconciliation
- ✅ Real-time enforcement status

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Android Studio (for Android apps)
- Docker & Docker Compose (optional)

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements/development.txt
   ```

4. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Generate encryption key for Monnify credentials:**
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```
   Add the output to `ENCRYPTION_KEY` in `.env`

6. **Create PostgreSQL database:**
   ```bash
   createdb mederpay
   ```

7. **Run migrations:**
   ```bash
   python manage.py migrate
   ```

8. **Create superuser:**
   ```bash
   python manage.py createsuperuser
   ```

9. **Start development server:**
   ```bash
   python manage.py runserver
   ```

The API will be available at `http://localhost:8000/api/`

API documentation at `http://localhost:8000/api/docs/`

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:3000/`

### Android Apps Setup

#### App A

1. **Navigate to App A directory:**
   ```bash
   cd android/MederPayEnforcerA
   ```

2. **Open in Android Studio:**
   ```bash
   studio .
   ```

3. **Update API endpoint in `app/build.gradle.kts`:**
   ```kotlin
   buildConfigField("String", "API_BASE_URL", "\"http://YOUR_SERVER_IP:8000/api\"")
   ```

4. **Build and run:**
   - Connect Android device or start emulator
   - Click Run ▶️

#### App B

Follow the same steps as App A but for the `android/MederPayEnforcerB` directory.

### Docker Setup (Alternative)

1. **Start all services:**
   ```bash
   docker-compose up -d
   ```

2. **Run migrations:**
   ```bash
   docker-compose exec backend python manage.py migrate
   ```

3. **Create superuser:**
   ```bash
   docker-compose exec backend python manage.py createsuperuser
   ```

Services:
- Backend: `http://localhost:8000`
- PostgreSQL: `localhost:5432`

## 📁 Project Structure

```
mederpay1/
├── backend/                    # Django REST API
│   ├── apps/
│   │   ├── platform/          # User, Agent, Registry, Billing
│   │   ├── agents/            # Staff, Customer, Phone, Sale
│   │   ├── payments/          # Payment, Installment, Monnify
│   │   ├── enforcement/       # DeviceCommand, HealthCheck
│   │   └── audit/             # AuditLogs
│   ├── config/                # Django settings
│   ├── requirements/          # Python dependencies
│   └── manage.py
├── android/                   # Android enforcement apps
│   ├── MederPayEnforcerA/    # App A project
│   │   └── app/src/main/kotlin/com/mederpay/enforcera/
│   │       ├── MainActivity.kt
│   │       ├── DeviceAdminReceiver.kt
│   │       ├── EnforcementService.kt
│   │       ├── OverlayActivity.kt
│   │       ├── BootReceiver.kt
│   │       ├── ApiClient.kt
│   │       └── CompanionMonitor.kt
│   └── MederPayEnforcerB/    # App B project (mirror)
├── frontend/                  # Next.js web platform
│   ├── app/                   # App Router pages
│   │   ├── dashboard/         # Dashboard pages
│   │   ├── login/            # Login page
│   │   └── register/         # Registration page
│   ├── components/           # React components
│   ├── lib/                  # Utilities and API client
│   └── public/               # Static assets
└── docker-compose.yml        # Docker configuration
```

## 🔐 Security Features

### Backend Security
- JWT token authentication with refresh mechanism
- Password hashing with Django's built-in validators
- SQL injection protection via Django ORM
- XSS protection via Django middleware
- CORS configuration for Next.js frontend
- Encrypted Monnify credentials using Fernet
- Rate limiting on authentication endpoints
- Webhook signature verification

### Android Security
- Device Admin API for enforcement
- APK signature verification
- Mutual monitoring between App A and App B
- Non-dismissible enforcement overlay
- Tamper-resistant architecture

### Frontend Security
- HTTP-only cookies for sensitive tokens
- Automatic token refresh
- Protected routes with authentication checks
- XSS protection via React

## 📊 Database Schema

### Core Tables

#### Users & Agents
- `users` - Custom user model with role-based access
- `agents` - Business profiles with Monnify credentials
- `agent_staff` - Sub-agents and sales staff
- `agent_billing` - Weekly/monthly billing records

#### Inventory & Sales
- `platform_phone_registry` - Global IMEI tracking
- `phones` - Device inventory
- `customers` - Customer profiles
- `sales` - Sales with ONE ACTIVE SALE constraint

#### Payments
- `payment_records` - Immutable payment audit trail
- `installment_schedules` - Payment schedules

#### Enforcement
- `device_commands` - Lock/unlock commands
- `device_health_checks` - Device status monitoring

#### Audit
- `platform_audit_logs` - Platform-level audit trail
- `agent_audit_logs` - Agent-level audit trail

## 🔗 API Endpoints

### Authentication
- `POST /api/auth/register/` - Agent registration
- `POST /api/auth/login/` - JWT login
- `POST /api/auth/refresh/` - Token refresh
- `POST /api/auth/logout/` - Logout

### Agent Management
- `GET /api/agents/dashboard/` - Dashboard statistics
- `GET /api/agents/me/` - Current agent profile
- `PATCH /api/agents/me/` - Update profile

### Phone Management
- `GET /api/phones/` - List phones
- `POST /api/phones/` - Register new phone
- `GET /api/phones/{id}/` - Phone details
- `GET /api/phones/{id}/status/` - Enforcement status

### Sales
- `GET /api/sales/` - List sales
- `POST /api/sales/` - Create sale
- `GET /api/sales/{id}/payment-status/` - Payment status

### Payments
- `GET /api/payments/` - Payment history
- `POST /api/payments/` - Record payment
- `GET /api/payments/overdue/` - Overdue payments
- `POST /api/webhooks/monnify/` - Monnify webhook

### Device Commands (Android API)
- `GET /api/device-commands/pending/` - Fetch pending commands
- `POST /api/device-commands/{id}/acknowledge/` - Acknowledge command
- `POST /api/device-commands/{id}/execute/` - Mark as executed

### Enforcement (Android API)
- `POST /api/enforcement/health-check/` - Device health check
- `GET /api/enforcement/status/{imei}/` - Get enforcement status

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd frontend
npm test
```

## 🚢 Deployment

### Backend Deployment (Docker)

1. **Build image:**
   ```bash
   cd backend
   docker build -t mederpay-backend .
   ```

2. **Run container:**
   ```bash
   docker run -p 8000:8000 \
     -e SECRET_KEY=your-secret-key \
     -e DB_HOST=your-db-host \
     -e DB_NAME=mederpay \
     -e DB_USER=postgres \
     -e DB_PASSWORD=your-password \
     mederpay-backend
   ```

### Frontend Deployment (Vercel)

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   cd frontend
   vercel --prod
   ```

3. **Set environment variables in Vercel dashboard:**
   - `NEXT_PUBLIC_API_URL`
   - `NEXT_PUBLIC_MONNIFY_API_KEY`

### Android Deployment

1. **Generate signed APK:**
   - Build → Generate Signed Bundle/APK
   - Select APK
   - Create/select keystore
   - Build release APK

2. **Distribute:**
   - Upload to Google Play Store, or
   - Distribute APK directly to agents

## 📝 Business Rules Enforced

1. **One Active Sale Per Phone** - PostgreSQL unique constraint
2. **Payment Balance Tracking** - Automatic balance calculation
3. **Automatic Device Unlock** - Triggered when balance is paid
4. **IMEI Blacklist Check** - Prevents operations on blacklisted devices
5. **Agent Credit Limit** - Enforces credit limits
6. **Audit Everything** - All actions are logged
7. **Webhook Verification** - Monnify webhooks are verified
8. **Command Expiry** - Device commands auto-expire after timeout

## 🤝 Contributing

This is a production-ready platform. For contributions:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

Proprietary - All rights reserved

## 📞 Support

For support, contact: support@mederpay.com

## 🎯 Roadmap

- [ ] WebSocket support for real-time updates
- [ ] Firebase Cloud Messaging for push notifications
- [ ] Advanced reporting and analytics
- [ ] Mobile app for agents (React Native)
- [ ] Multi-currency support
- [ ] SMS notifications
- [ ] WhatsApp integration
- [ ] Biometric authentication

## ⚠️ Important Notes

1. **Security**: Always change default credentials in production
2. **Encryption**: Generate a strong encryption key for Monnify credentials
3. **Android**: Both App A and App B must be installed on customer devices
4. **Database**: Regular backups are essential
5. **API**: Rate limiting should be configured in production
6. **Monitoring**: Set up application monitoring (e.g., Sentry)

## 📚 Additional Resources

- [Django Documentation](https://docs.djangoproject.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Android Device Admin](https://developer.android.com/guide/topics/admin/device-admin)
- [Monnify API Documentation](https://docs.monnify.com/)

---

Built with ❤️ for agent management and payment enforcement