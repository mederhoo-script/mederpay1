import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { registerSchema } from '@/lib/validations'

const DEFAULT_AGENT_ROLE = 'agent_owner' as const

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = registerSchema.parse(body)
    
    const supabase = await createClient()
    
    // 1. Check if user already exists to avoid rate limit issues
    const serviceClient = createServiceClient()
    
    // Check if email already exists - use listUsers with pagination to limit results
    // Note: This is still needed as a pre-check to avoid triggering signUp rate limits
    const { data: userList } = await serviceClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    })
    
    const emailExists = userList?.users?.some(
      user => user.email?.toLowerCase() === validatedData.email.toLowerCase()
    )
    
    if (emailExists) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please try logging in or use a different email.' },
        { status: 400 }
      )
    }
    
    // Check if username is already taken using maybeSingle to avoid errors
    const { data: existingProfile } = await serviceClient
      .from('profiles')
      .select('username')
      .eq('username', validatedData.username)
      .maybeSingle()
    
    if (existingProfile) {
      return NextResponse.json(
        { error: 'This username is already taken. Please choose a different username.' },
        { status: 400 }
      )
    }
    
    // 2. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        data: {
          username: validatedData.username,
        },
        // Disable email confirmation to avoid rate limiting issues
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/auth/callback`,
      }
    })
    
    if (authError) {
      // Handle rate limit errors with a more user-friendly message
      if (authError.message.toLowerCase().includes('rate limit') || 
          authError.message.toLowerCase().includes('email rate') ||
          authError.status === 429) {
        return NextResponse.json(
          { error: 'Too many registration attempts detected. This email may have been used in recent failed attempts. Please wait 10-15 minutes before trying again, or try using a different email address.' },
          { status: 429 }
        )
      }
      // Handle duplicate user error
      if (authError.message.toLowerCase().includes('user already registered') ||
          authError.message.toLowerCase().includes('already exists')) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please try logging in or use the password reset feature.' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: authError?.message || 'Failed to create user' },
        { status: 400 }
      )
    }
    
    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 400 }
      )
    }
    
    // 3. Create profile record using service role client (bypasses RLS)
    const { error: profileError } = await serviceClient
      .from('profiles')
      .insert({
        id: authData.user.id,
        username: validatedData.username,
        first_name: validatedData.first_name,
        last_name: validatedData.last_name,
        phone_number: validatedData.phone_number || null,
        role: DEFAULT_AGENT_ROLE,
      })
    
    if (profileError) {
      // Clean up: Delete the auth user if profile creation fails
      await serviceClient.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: 'Failed to create profile: ' + profileError.message },
        { status: 500 }
      )
    }
    
    // 4. Create agent record using service role client (bypasses RLS)
    const { error: agentError } = await serviceClient
      .from('agents')
      .insert({
        user_id: authData.user.id,
        business_name: validatedData.business_name,
        business_address: validatedData.business_address || null,
      })
    
    if (agentError) {
      // Clean up: Delete the profile and auth user if agent creation fails
      // Use Promise.allSettled to ensure both operations are attempted
      await Promise.allSettled([
        serviceClient.from('profiles').delete().eq('id', authData.user.id),
        serviceClient.auth.admin.deleteUser(authData.user.id)
      ])
      return NextResponse.json(
        { error: 'Failed to create agent: ' + agentError.message },
        { status: 500 }
      )
    }
    
    // 5. Return user data and session
    return NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        username: validatedData.username,
        first_name: validatedData.first_name,
        last_name: validatedData.last_name,
        phone_number: validatedData.phone_number,
        role: DEFAULT_AGENT_ROLE,
      },
      session: authData.session,
    }, { status: 201 })
    
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
