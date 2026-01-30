# Quick Start Guide - Registration & Login Fix

## 🚀 Quick Setup (3 Steps)

### Step 1: Apply Database Changes (REQUIRED)
1. Open Supabase SQL Editor in your project dashboard
2. Copy the contents of `FIX_REGISTRATION.sql`
3. Paste and run in SQL Editor
4. Verify: You should see "Success. No rows returned" or similar

### Step 2: Disable Email Confirmation (RECOMMENDED for testing)
1. Go to your Supabase project dashboard → Authentication → Settings
2. Find "Email Auth" section
3. **Disable** "Confirm email" option
4. Save changes

> **Why?** By default, Supabase requires users to confirm their email before they can log in. Disabling this allows immediate login after registration.

### Step 3: Create .env.local File
Copy this template into `nextjs-app/.env.local` and replace with your actual credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Monnify API Credentials
MONNIFY_API_KEY=your-monnify-api-key
MONNIFY_SECRET_KEY=your-monnify-secret-key
MONNIFY_CONTRACT_CODE=your-contract-code
MONNIFY_BASE_URL=https://sandbox.monnify.com
MONNIFY_WEBHOOK_SECRET=your-webhook-secret-here
```

**Note:** The actual `.env.local` file with your credentials has already been created in the `nextjs-app` directory. The above is just a template for reference.

## 🧪 Testing

### Test Registration
```bash
cd nextjs-app
npm install
npm run dev
```

1. Open http://localhost:3000/register
2. Fill in the form:
   - First Name: John
   - Last Name: Doe
   - Username: johndoe
   - Email: john.doe@example.com
   - Password: password123
   - Confirm Password: password123
   - Business Name: John's Electronics
3. Click "Create account"
4. ✅ Should redirect to /dashboard

### Test Login
1. Open http://localhost:3000/login
2. Enter credentials from registration
3. Click "Sign in"
4. ✅ Should redirect to /dashboard

## 🔍 Troubleshooting

### "Failed to create profile" Error
- **Cause:** RLS policies not applied
- **Fix:** Run `FIX_REGISTRATION.sql` in Supabase SQL Editor

### "Email not confirmed" Error  
- **Cause:** Email confirmation is enabled
- **Fix:** Disable in Supabase Auth Settings → Email Auth → Confirm email

### "Profile not found" on Login
- **Cause:** User created manually without profile record
- **Fix:** Run this SQL to check and fix:
```sql
-- Check if profile exists
SELECT * FROM public.profiles WHERE id = (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);

-- If missing, create profile
INSERT INTO public.profiles (id, username, first_name, last_name, role, is_active)
SELECT 
  id,
  split_part(email, '@', 1), -- username from email
  'First',
  'Last',
  'agent_owner',
  true
FROM auth.users 
WHERE email = 'your-email@example.com';

-- Create agent record
INSERT INTO public.agents (user_id, business_name)
SELECT id, 'Business Name'
FROM auth.users 
WHERE email = 'your-email@example.com';
```

### "Account is inactive" Error
- **Cause:** User's `is_active` field is false
- **Fix:** 
```sql
UPDATE public.profiles 
SET is_active = true 
WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
```

## ✅ What Was Fixed

1. **Missing RLS Policies** - Added INSERT policies for profiles and agents tables
2. **Error Handling** - Fixed frontend to read correct error field from API
3. **Environment Setup** - Created .env.local with your credentials
4. **Documentation** - Comprehensive guides and SQL scripts

## 📁 Files Created/Modified

- ✅ `FIX_REGISTRATION.sql` - Quick SQL fix script
- ✅ `REGISTRATION_FIX_README.md` - Detailed documentation
- ✅ `QUICK_START_REGISTRATION.md` - This file
- ✅ `nextjs-app/.env.local` - Environment variables (not committed)
- ✅ `nextjs-app/app/register/page.tsx` - Fixed error handling
- ✅ `nextjs-app/app/login/page.tsx` - Fixed error handling
- ✅ `nextjs-app/supabase/migrations/20260130_fix_registration_policies.sql` - Migration file

## 🎯 Success Checklist

- [ ] SQL script executed in Supabase
- [ ] Email confirmation disabled (optional but recommended)
- [ ] .env.local file created with credentials
- [ ] `npm install` completed successfully
- [ ] `npm run dev` starts without errors
- [ ] Can register a new user
- [ ] Can login with registered user
- [ ] Redirected to dashboard after login

## 📞 Need Help?

Check the detailed documentation in `REGISTRATION_FIX_README.md` for more information.
