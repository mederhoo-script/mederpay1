# Error Message Source: "Too many registration attempts"

## Answer: This is from YOUR CODE (not Supabase)

### Location
**File**: `nextjs-app/app/api/auth/register/route.ts`  
**Lines**: 30-39

### The Code
```typescript
if (authError) {
  // Handle rate limit errors with a more user-friendly message
  if (authError.message.toLowerCase().includes('rate limit') || 
      authError.message.toLowerCase().includes('email rate') ||
      authError.status === 429) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please wait a few minutes before trying again.' },
      { status: 429 }
    )
  }
  // ... other error handling
}
```

## How It Works

### Supabase Sends:
- **Original error**: "Email rate limit exceeded" (technical message)
- **HTTP Status**: 429 (Too Many Requests)

### Your Code Detects and Translates:
1. **Checks** if Supabase's error contains "rate limit" or "email rate" or status is 429
2. **Replaces** the technical message with user-friendly message
3. **Returns**: "Too many registration attempts. Please wait a few minutes before trying again."

## Why This Was Added

**Problem**: Supabase's raw error "Email rate limit exceeded" was confusing to users

**Solution**: Wrap Supabase's rate limit error in a more user-friendly message

## Flow Diagram

```
User tries to register
    ↓
Supabase Auth API
    ↓
Supabase detects too many emails to same address
    ↓
Supabase returns: "Email rate limit exceeded" (status 429)
    ↓
Your Code (line 32-34) detects this error
    ↓
Your Code replaces with: "Too many registration attempts. Please wait..."
    ↓
User sees friendly message
```

## When This Appears

This message shows when:
1. User tries to register multiple times with same email in short period
2. Supabase has already sent confirmation emails
3. Supabase's rate limiting kicks in (typically 3-5 emails per hour per address)

## Summary

**SOURCE**: Your custom code (line 36)  
**TRIGGER**: Supabase rate limit error  
**PURPOSE**: Make error message more user-friendly  

The actual rate limiting is done by **Supabase**, but the error message the user sees is **customized by your code**.
