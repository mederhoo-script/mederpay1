import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { staffSchema } from '@/lib/validations'

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if (!profile || profile.role !== 'agent_owner') {
      return NextResponse.json(
        { error: 'Forbidden: Only agents can access staff' },
        { status: 403 }
      )
    }
    
    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('user_id', user.id)
      .single()
    
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }
    
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
    
    if (staffError) {
      return NextResponse.json(
        { error: staffError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ staff }, { status: 200 })
    
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

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if (!profile || profile.role !== 'agent_owner') {
      return NextResponse.json(
        { error: 'Forbidden: Only agents can create staff' },
        { status: 403 }
      )
    }
    
    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('user_id', user.id)
      .single()
    
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }
    
    const body = await request.json()
    const validation = staffSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const staffData = validation.data
    
    const { data: staffMember, error: staffError } = await supabase
      .from('staff')
      .insert({
        agent_id: agent.id,
        full_name: staffData.full_name,
        role: staffData.role,
        commission_rate: staffData.commission_rate,
      })
      .select()
      .single()
    
    if (staffError) {
      return NextResponse.json(
        { error: 'Failed to create staff member', details: staffError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ staff: staffMember }, { status: 201 })
    
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
