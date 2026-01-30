import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get current user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }
    
    // Fetch agent data if user is an agent_owner
    let agent = null
    if (profile.role === 'agent_owner') {
      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', user.id)
        .single()
      
      if (!agentError && agentData) {
        agent = agentData
      }
    }
    
    // Return user profile data
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: profile.username,
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone_number: profile.phone_number,
        role: profile.role,
        is_active: profile.is_active,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
      agent: agent ? {
        id: agent.id,
        business_name: agent.business_name,
        business_address: agent.business_address,
        credit_limit: agent.credit_limit,
        credit_used: agent.credit_used,
        credit_available: agent.credit_available,
        is_active: agent.is_active,
      } : null,
    }, { status: 200 })
    
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
