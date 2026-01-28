import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { registerSchema } from '@/lib/validations'

const DEFAULT_AGENT_ROLE = 'agent_owner' as const

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = registerSchema.parse(body)
    
    const supabase = await createClient()
    
    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        data: {
          username: validatedData.username,
        }
      }
    })
    
    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Failed to create user' },
        { status: 400 }
      )
    }
    
    // 2. Create profile record
    const { error: profileError } = await supabase
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
      return NextResponse.json(
        { error: 'Failed to create profile: ' + profileError.message },
        { status: 500 }
      )
    }
    
    // 3. Create agent record
    const { error: agentError } = await supabase
      .from('agents')
      .insert({
        user_id: authData.user.id,
        business_name: validatedData.business_name,
        business_address: validatedData.business_address || null,
      })
    
    if (agentError) {
      return NextResponse.json(
        { error: 'Failed to create agent: ' + agentError.message },
        { status: 500 }
      )
    }
    
    // 4. Return user data and session
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
