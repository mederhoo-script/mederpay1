# Backend and Frontend Setup - Successfully Connected! 🎉

This document provides instructions for starting and testing the MederPay backend and frontend services.

## ✅ Current Status

Both backend and frontend are successfully running and can communicate with each other:
- **Backend API**: Running on http://localhost:8000
- **Frontend App**: Running on http://localhost:3000
- **Database**: PostgreSQL running via Docker on port 5432
- **CORS**: Properly configured for local development
- **Authentication**: Fixed to use email-based login

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Python 3.11+
- Node.js 18+

### 1. Start the Database

```bash
cd /path/to/mederpay1
docker compose up -d db
```

Wait a few seconds for PostgreSQL to initialize.

### 2. Start the Backend

```bash
cd backend

# Create environment file (if not exists)
cp .env.example .env

# Generate and add encryption key to .env
python -c "from cryptography.fernet import Fernet; print(f'ENCRYPTION_KEY={Fernet.generate_key().decode()}')"

# Create logs directory
mkdir -p logs

# Install dependencies
pip install -r requirements/development.txt

# Run migrations
python manage.py migrate

# Create superuser (optional, for testing)
python manage.py createsuperuser --email admin@mederpay.com

# Start the development server
python manage.py runserver 0.0.0.0:8000
```

The backend will be available at **http://localhost:8000**

### 3. Start the Frontend

In a new terminal:

```bash
cd frontend

# Create environment file (if not exists)
cp .env.example .env.local

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at **http://localhost:3000**

## 🧪 Testing the Connection

### Test 1: Backend API Health Check

```bash
# Check API documentation
curl http://localhost:8000/api/docs/

# Test login endpoint (should return validation error)
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

### Test 2: Frontend Access

Open your browser and navigate to:
- **Frontend**: http://localhost:3000
- **Login Page**: http://localhost:3000/login
- **Register Page**: http://localhost:3000/register

### Test 3: Full Authentication Flow

1. Open http://localhost:3000/login in your browser
2. Enter credentials:
   - **Email**: admin@mederpay.com
   - **Password**: admin123
3. Click "Sign in"
4. You should be redirected to the dashboard

**Note**: If you created the superuser without setting a password, set it with:
```bash
cd backend
echo "from django.contrib.auth import get_user_model; User = get_user_model(); user = User.objects.get(email='admin@mederpay.com'); user.set_password('admin123'); user.save()" | python manage.py shell
```

## 🔧 What Was Fixed

### Authentication Mismatch
The original implementation had a mismatch between frontend and backend:
- **Frontend** was sending `username` in login requests
- **Backend** was expecting `email` 

**Fix**: Updated frontend to use `email` field instead of `username`:
- Modified `frontend/app/login/page.tsx` to use email input
- Updated `frontend/lib/auth.ts` to send email parameter

### Environment Configuration
- Created `.env` file for backend with generated encryption key
- Created `.env.local` file for frontend with correct API URL
- Added `logs/` directory to `.gitignore`

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login/` - Login with email and password
- `POST /api/auth/register/` - Register new agent account
- `POST /api/auth/refresh/` - Refresh JWT token
- `POST /api/auth/logout/` - Logout

### Documentation
- `GET /api/docs/` - Interactive API documentation (Swagger UI)

### Health Check
Test CORS with:
```bash
curl -X OPTIONS http://localhost:8000/api/auth/login/ \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -i
```

You should see CORS headers in the response.

## 🔐 Test Credentials

**Superuser Account**:
- Email: admin@mederpay.com
- Password: admin123
- Role: platform_admin

## 🐛 Troubleshooting

### Backend won't start
- **Error**: "Unable to configure handler 'file'"
  - **Solution**: Create the logs directory: `mkdir -p backend/logs`

- **Error**: "No module named..."
  - **Solution**: Install dependencies: `pip install -r requirements/development.txt`

### Frontend can't connect to backend
- **Error**: "Network Error" or CORS errors
  - **Solution**: Ensure backend is running on port 8000
  - **Solution**: Check `.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:8000/api`

### Database connection issues
- **Error**: "could not connect to server"
  - **Solution**: Ensure PostgreSQL is running: `docker compose ps`
  - **Solution**: Start it with: `docker compose up -d db`

### Login fails with 400 error
- **Error**: Backend returns 400 on login
  - **Solution**: Ensure you're sending `email` (not `username`) in the request
  - **Solution**: This was fixed in commit 8a8854d

## 📝 Important Notes

1. **CORS Configuration**: The backend is configured to allow requests from `http://localhost:3000` and `http://127.0.0.1:3000`

2. **JWT Tokens**: Access tokens expire after 1 hour. The frontend automatically refreshes them using the refresh token.

3. **User Model**: The custom user model uses `email` as the username field, not a separate username.

4. **Development Mode**: Both servers are running in development mode with hot reloading enabled.

5. **Database**: PostgreSQL data is persisted in a Docker volume named `mederpay1_postgres_data`

## 🌐 Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Next.js web application |
| Backend API | http://localhost:8000/api | Django REST API |
| API Docs | http://localhost:8000/api/docs/ | Swagger UI documentation |
| PostgreSQL | localhost:5432 | Database (via Docker) |

## ✨ Screenshots

### Login Page (After Fix)
![Login Page](https://github.com/user-attachments/assets/619977a2-735b-4d77-857b-43cb230c7079)

The login page now correctly shows "Email" field instead of "Username".

### Login Attempt (Before Fix)
![Login Failed](https://github.com/user-attachments/assets/f04e53c3-30bc-40d8-8444-3e15c1fbe81b)

This showed the error when credentials were entered with the old username-based system.

## 🎯 Next Steps

Now that backend and frontend are successfully connected, you can:
1. Register a new agent account via http://localhost:3000/register
2. Explore the dashboard at http://localhost:3000/dashboard
3. Test API endpoints via the docs at http://localhost:8000/api/docs/
4. Add phones, create sales, and test the payment flow

## 📚 Additional Resources

- [Django Documentation](https://docs.djangoproject.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [MederPay README](./README.md)

---

**Status**: ✅ Backend and Frontend are successfully connected and communicating!
