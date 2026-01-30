# Registration and Login Fix Guide

## Problem Summary
The registration and login features were not working due to:
1. Missing RLS (Row Level Security) policies for INSERT operations on `profiles` and `agents` tables
2. Error handling mismatch in frontend code
3. Missing environment variables

## Changes Made

### 1. Fixed RLS Policies
**File:** `FIX_REGISTRATION.sql` (in project root)

The Supabase database had RLS policies for SELECT and UPDATE operations, but was missing INSERT policies. When users tried to register, the database would reject the INSERT operations because there were no policies allowing authenticated users to create their own profile and agent records.

**Solution:** Added two new RLS policies:
- `Users can insert their own profile` - Allows users to INSERT into `profiles` table during registration
- `Users can insert their own agent record` - Allows users to INSERT into `agents` table during registration

**How to Apply:** 
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `FIX_REGISTRATION.sql`
4. Run the script

### 2. Fixed Frontend Error Handling
**Files:** 
- `nextjs-app/app/register/page.tsx`
- `nextjs-app/app/login/page.tsx`

The API routes return errors in a field named `error`, but the frontend was checking for a field named `message`. This caused generic error messages to be displayed instead of the actual error from the server.

**Changes:**
- Changed `data.message` to `data.error` in both files

### 3. Created Environment Variables File
**File:** `nextjs-app/.env.local`

Created the environment variables file with the Supabase credentials and Monnify API configuration you provided.

## Setup Instructions

### Step 1: Apply Database Changes
1. Log into your Supabase dashboard at https://supabase.com
2. Navigate to your project dashboard
3. Go to the SQL Editor (left sidebar)
4. Open the file `FIX_REGISTRATION.sql` from the project root
5. Copy its contents and paste into the SQL Editor
6. Click "Run" to execute the script
7. You should see a confirmation that policies were created

### Step 2: Verify Environment Variables
The `.env.local` file has been created in the `nextjs-app` directory with your credentials. Verify it contains:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### Step 3: Run the Application
```bash
cd nextjs-app
npm install
npm run dev
```

The application will start on http://localhost:3000

### Step 4: Test Registration
1. Navigate to http://localhost:3000/register
2. Fill in the registration form with:
   - First Name
   - Last Name
   - Username
   - Email
   - Password (at least 8 characters)
   - Confirm Password
   - Business Name
   - Business Address (optional)
3. Click "Create account"
4. You should be redirected to the dashboard

### Step 5: Test Login
1. Navigate to http://localhost:3000/login
2. Enter the email and password you used during registration
3. Click "Sign in"
4. You should be redirected to the dashboard

## Testing with Manually Created Users

If you manually created a user in Supabase before applying these fixes:

1. Make sure the user has corresponding records in both the `profiles` and `agents` tables
2. Check that the `profiles.is_active` field is set to `true`
3. Verify that the user's role in the `profiles` table is set to `'agent_owner'`

You can check this with the following SQL query in Supabase:

```sql
-- Check user data
SELECT 
  p.id,
  p.email,
  p.username,
  p.first_name,
  p.last_name,
  p.role,
  p.is_active,
  a.id as agent_id,
  a.business_name
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.agents a ON p.id = a.user_id
WHERE u.email = 'your-email@example.com';
```

If the profile or agent record is missing, you can create them manually:

```sql
-- Insert profile (replace values with actual data)
INSERT INTO public.profiles (id, username, first_name, last_name, role, is_active)
VALUES (
  'user-uuid-from-auth-users',
  'username',
  'First',
  'Last',
  'agent_owner',
  true
);

-- Insert agent record (replace values with actual data)
INSERT INTO public.agents (user_id, business_name)
VALUES (
  'user-uuid-from-auth-users',
  'Business Name'
);
```

## Troubleshooting

### Issue: Registration still fails
1. Verify the SQL script was executed successfully
2. Check Supabase logs for detailed error messages
3. Make sure email confirmation is disabled in Supabase Auth settings (or handle email confirmation flow)

### Issue: Login fails with "Profile not found"
1. Make sure the user has a record in the `profiles` table
2. Check that `profiles.is_active` is `true`
3. Run the SQL query above to verify user data

### Issue: Login fails with "Account is inactive"
1. Update the user's profile: `UPDATE public.profiles SET is_active = true WHERE id = 'user-uuid';`

### Issue: Can't see the data after login
1. This might be due to RLS policies blocking access
2. Verify the user has an `agents` record
3. Check that the agent record is properly linked to the profile

## Files Modified
- `nextjs-app/app/register/page.tsx` - Fixed error handling
- `nextjs-app/app/login/page.tsx` - Fixed error handling
- `nextjs-app/.env.local` - Created with your credentials
- `nextjs-app/supabase/migrations/20260130_fix_registration_policies.sql` - New migration file
- `FIX_REGISTRATION.sql` - Standalone SQL script for easy execution

## Additional Notes

### Email Confirmation
By default, Supabase requires email confirmation for new users. To disable this for testing:
1. Go to Supabase Dashboard → Authentication → Settings
2. Find "Email Auth" settings
3. Disable "Confirm email" option

### Security Considerations
1. The `.env.local` file contains sensitive credentials and should never be committed to git (it's in .gitignore)
2. The SUPABASE_SERVICE_ROLE_KEY has full database access and should be kept secure
3. Consider enabling email confirmation in production
4. Review and test all RLS policies before deploying to production

## Success Criteria
✅ Users can register with the form
✅ New users are created in auth.users
✅ Profile records are created automatically
✅ Agent records are created automatically
✅ Users can log in with their credentials
✅ Users are redirected to the dashboard after login
✅ Login correctly checks if account is active
