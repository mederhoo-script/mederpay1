import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { agentSettingsSchema } from '@/lib/validations'

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
    
    // Fetch agent data
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }
    
    // Return complete profile with agent details
    return NextResponse.json({
      profile: {
        id: profile.id,
        username: profile.username,
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone_number: profile.phone_number,
        role: profile.role,
        is_active: profile.is_active,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
      agent: {
        id: agent.id,
        business_name: agent.business_name,
        business_address: agent.business_address,
        nin: agent.nin,
        bvn: agent.bvn,
        credit_limit: agent.credit_limit,
        credit_used: agent.credit_used,
        credit_available: agent.credit_available,
        monnify_api_key: agent.monnify_api_key,
        monnify_secret_key: agent.monnify_secret_key,
        monnify_contract_code: agent.monnify_contract_code,
        monnify_account_reference: agent.monnify_account_reference,
        monnify_account_number: agent.monnify_account_number,
        monnify_bank_name: agent.monnify_bank_name,
        is_active: agent.is_active,
        created_at: agent.created_at,
        updated_at: agent.updated_at,
      },
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

export async function PATCH(request: Request) {
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
    
    // Parse and validate request body
    const body = await request.json()
    const validation = agentSettingsSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const data = validation.data
    
    // Get agent data to ensure it exists
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id')
      .eq('user_id', user.id)
      .single()
    
    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }
    
    // Update agent settings
    const updateData: {
      updated_at: string
      business_name?: string
      business_address?: string | null
      nin?: string | null
      bvn?: string | null
      monnify_api_key?: string
      monnify_secret_key?: string
      monnify_contract_code?: string
    } = {
      updated_at: new Date().toISOString(),
    }
    
    // Only include fields that were provided in the request
    if (data.business_name) updateData.business_name = data.business_name
    if (data.business_address !== undefined) updateData.business_address = data.business_address
    if (data.nin !== undefined) updateData.nin = data.nin || null
    if (data.bvn !== undefined) updateData.bvn = data.bvn || null
    if (data.monnify_api_key !== undefined) updateData.monnify_api_key = data.monnify_api_key
    if (data.monnify_secret_key !== undefined) updateData.monnify_secret_key = data.monnify_secret_key
    if (data.monnify_contract_code !== undefined) updateData.monnify_contract_code = data.monnify_contract_code
    
    const { data: updatedAgent, error: updateError } = await supabase
      .from('agents')
      .update(updateData)
      .eq('id', agent.id)
      .select()
      .single()
    
    if (updateError) {
      throw new Error('Failed to update agent settings')
    }
    
    return NextResponse.json({
      message: 'Profile updated successfully',
      agent: updatedAgent,
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
