import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { phoneSchema } from '@/lib/validations'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    
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
        { error: 'Forbidden: Only agents can access phones' },
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
    
    const { data: phone, error: phoneError } = await supabase
      .from('phones')
      .select('*')
      .eq('id', id)
      .eq('agent_id', agent.id)
      .single()
    
    if (phoneError || !phone) {
      return NextResponse.json(
        { error: 'Phone not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ phone }, { status: 200 })
    
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    
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
        { error: 'Forbidden: Only agents can update phones' },
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
    
    const { data: existingPhone } = await supabase
      .from('phones')
      .select('*')
      .eq('id', id)
      .eq('agent_id', agent.id)
      .single()
    
    if (!existingPhone) {
      return NextResponse.json(
        { error: 'Phone not found' },
        { status: 404 }
      )
    }
    
    const body = await request.json()
    
    // Remove imei from update data - it cannot be changed
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { imei, ...updateData } = body
    
    const validation = phoneSchema.partial().safeParse(updateData)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const { data: phone, error: phoneError } = await supabase
      .from('phones')
      .update(validation.data)
      .eq('id', id)
      .eq('agent_id', agent.id)
      .select()
      .single()
    
    if (phoneError) {
      return NextResponse.json(
        { error: 'Failed to update phone', details: phoneError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ phone }, { status: 200 })
    
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    
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
        { error: 'Forbidden: Only agents can delete phones' },
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
    
    const { data: existingPhone } = await supabase
      .from('phones')
      .select('*')
      .eq('id', id)
      .eq('agent_id', agent.id)
      .single()
    
    if (!existingPhone) {
      return NextResponse.json(
        { error: 'Phone not found' },
        { status: 404 }
      )
    }
    
    const { error: deleteError } = await supabase
      .from('phones')
      .delete()
      .eq('id', id)
      .eq('agent_id', agent.id)
    
    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete phone', details: deleteError.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ message: 'Phone deleted successfully' }, { status: 200 })
    
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
